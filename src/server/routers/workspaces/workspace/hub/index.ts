import { router } from '~/server/trpc';
import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import StringToObjectID from '~/utils/StringToObjectID';
import { TRPCError } from '@trpc/server';
import { capturePageScreenshotAndUpload } from '~/services/images.service';
import { v4 } from 'uuid';
import { Filter } from 'mongodb';
import { HubResourceOpen } from '~/services/NewMongoTypes';
import { searchRobloxUsersByUsername } from '~/services/roblox.service';
import { presignUrl, uploadImage, uploadImageBuffer } from '~/services/CDN-service';
import { getMimeByExt } from '~/utils/File';
import { departmentScopeIds } from '~/services/departmentPermissions.service';

export const workspaceKnowledgeHub = router({
  getContainers: workspaceProcedure.input(z.object({
    groupId: z.string(),
  })).query(async ({ input, ctx }) => {
    const { workspace, user, department } = ctx;
    const { groupId } = input;
    const containers = await readminCollections.hub_container.find({ groupId }).toArray();
    const isAdminAndCanDisplayall = department.permissions?.knowledgeHub?.manage || department.permissions?.admin;
    // Match against every department the member's roles map into, not just the
    // primary one.
    const scopeIds = new Set(departmentScopeIds(department).map(id => id.toString()));
    const filteredContainers = isAdminAndCanDisplayall ? containers : containers.filter(container => container.visibleToDepartments.some(a => scopeIds.has(a?.toString() || '')))
    return await Promise.all(filteredContainers.map(async container => {
      return {
        ...container,
        resources: await Promise.all((await readminCollections.hub_resource.find({ container: container._id }).toArray()).map(async resource => {
          try {
            return {
              ...resource,
              url: isAdminAndCanDisplayall ? resource.url : 'must-request',
              previewThumbnail: await presignUrl(resource?.coverImage || resource.previewThumbnail, 60)
            }
          } catch (e) {
            return {
              ...resource,
              url: isAdminAndCanDisplayall ? resource.url : 'must-request',
              previewThumbnail: 'https://cdn.readmin.app/readmin-public/InGameImage.png'
            }
          }
        }))
      }
    }))
  }),
  openResource: workspaceProcedure.input(z.object({
    groupId: z.string(),
    resourceId: z.string()
  })).mutation(async ({ input, ctx }) => {
    const { workspace, user, department } = ctx;
    const { groupId, resourceId } = input;
    const resource = await readminCollections.hub_resource.findOne({
      _id: StringToObjectID(resourceId),
      groupId
    });
    if (!resource) {
      return new TRPCError({
        message: 'No resource found',
        code: 'BAD_REQUEST'
      })
    }

    // Log access
    await readminCollections.hub_resource_open.insertOne({
      groupId,
      resourceId: resource._id,
      userId: user.dbUser.robloxId,
      url: resource.cdnFilePath ? `cdn://${resource.cdnFilePath}` : resource.url,
      date: new Date()
    })

    // If this resource uses a CDN file, generate a short-lived signed URL (5 min)
    if (resource.cdnFilePath) {
      const signedUrl = await presignUrl(resource.cdnFilePath, 300);
      return signedUrl;
    }

    return resource.url;
  }),
  createContainer: workspaceProcedure.input(z.object({
    groupId: z.string(),
    name: z.string(),
    description: z.string(),
    departments: z.array(z.string())
  })).mutation(async ({ input, ctx }) => {
    const { workspace, user, department } = ctx;
    const { groupId, name, description, departments } = input;
    if (!department.permissions.admin && !department.permissions?.knowledgeHub?.manage) {
      return new TRPCError({
        message: 'You do not have permission to do this',
        code: 'UNAUTHORIZED'
      })
    }

    const foundDepartments = await readminCollections.department.find({
      _id: { $in: departments.map(a => StringToObjectID(a)) },
    }).toArray()

    await readminCollections.hub_container.insertOne({
      groupId,
      name,
      description,
      visibleToDepartments: foundDepartments.map(a => a._id),
      resources: [],
      created: new Date()
    })
  }),
  createResource: workspaceProcedure.input(z.object({
    groupId: z.string(),
    name: z.string(),
    description: z.string(),
    url: z.string().optional(),
    containerId: z.string(),
    file: z.tuple([z.string(), z.string()]).optional(), // [fileName, base64Data]
  })).mutation(async ({ input, ctx }) => {
    const { workspace, user, department } = ctx;
    const { groupId, name, description, url, containerId, file } = input;
    if (!department.permissions.admin && !department.permissions?.knowledgeHub?.manage) {
      return new TRPCError({
        message: 'You do not have permission to do this',
        code: 'UNAUTHORIZED'
      })
    }

    if (!url && !file) {
      return new TRPCError({
        message: 'You must provide either a URL or a file',
        code: 'BAD_REQUEST'
      })
    }

    const container = await readminCollections.hub_container.findOne({
      _id: StringToObjectID(containerId),
      groupId
    });

    if (!container) {
      return new TRPCError({
        message: 'No container found',
        code: 'BAD_REQUEST'
      })
    }

    if (url !== undefined) {
      try {
        new URL(url);
      } catch (e) {
        return new TRPCError({
          message: 'Invalid URL',
          code: 'BAD_REQUEST'
        })
      }
    }

    let cdnFilePath: string | undefined;
    if (file) {
      const [fileName, fileData] = file;
      const id = v4();
      cdnFilePath = `workspaces/${groupId}/hub/files/${user.dbUser.robloxId}/${id}-${fileName}`;
      const buffer = Buffer.from((fileData.split(',') as any)[1], 'base64');
      const ext = fileName.substring(fileName.lastIndexOf('.') + 1);
      const contentType = getMimeByExt(ext);
      await uploadImageBuffer(cdnFilePath, buffer, contentType, 'private');
    }

    const inserted = await readminCollections.hub_resource.insertOne({
      groupId,
      name,
      description,
      url: url || '',
      container: container._id,
      created: new Date(),
      createdBy: user.dbUser.robloxId,
      previewThumbnail: '',
      ...(cdnFilePath ? { cdnFilePath } : {})
    })

    await readminCollections.hub_container.updateOne({
      _id: container._id
    }, {
      $push: {
        resources: inserted.insertedId
      }
    })

    // Capture a thumbnail for the resource
    const suffix = `workspaces/${groupId}/users/${user.dbUser.robloxId}/hub/${container._id}/resource/${inserted.insertedId.toString()}/capture.png`;
    if (url) {
      await capturePageScreenshotAndUpload(url, suffix);
    } else if (cdnFilePath) {
      // Generate a short-lived presigned URL and screenshot the file (e.g. PDF viewer)
      const signedUrl = await presignUrl(cdnFilePath, 60);
      await capturePageScreenshotAndUpload(signedUrl, suffix);
    }

    if (url || cdnFilePath) {
      await readminCollections.hub_resource.updateOne({
        _id: inserted.insertedId
      }, {
        $set: {
          previewThumbnail: suffix
        }
      })
    }

  }),



  updateContainer: workspaceProcedure.input(z.object({
    groupId: z.string(),
    containerId: z.string(),
    name: z.string(),
    description: z.string(),
    departments: z.array(z.string())
  })).mutation(async ({ input, ctx }) => {
    const { workspace, user, department } = ctx;
    const { groupId, containerId, name, description, departments } = input;
    if (!department.permissions.admin && !department.permissions?.knowledgeHub?.manage) {
      return new TRPCError({
        message: 'You do not have permission to do this',
        code: 'UNAUTHORIZED'
      })
    }

    const foundContainer = await readminCollections.hub_container.findOne({
      _id: StringToObjectID(containerId),
      groupId
    });

    if (!foundContainer) {
      return new TRPCError({
        message: 'No container found',
        code: 'BAD_REQUEST'
      })
    }

    const foundDepartments = await readminCollections.department.find({
      _id: { $in: departments.map(a => StringToObjectID(a)) },
    }).toArray()

    await readminCollections.hub_container.updateOne({
      _id: StringToObjectID(containerId),
      groupId
    }, {
      $set: {
        name,
        description,
        visibleToDepartments: foundDepartments.map(a => a._id)
      }
    })


  }),
  deleteContainer: workspaceProcedure.input(z.object({
    groupId: z.string(),
    containerId: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const { workspace, user, department } = ctx;
    const { groupId, containerId } = input;
    if (!department.permissions.admin && !department.permissions?.knowledgeHub?.manage) {
      return new TRPCError({
        message: 'You do not have permission to do this',
        code: 'UNAUTHORIZED'
      })
    }

    const foundContainer = await readminCollections.hub_container.findOne({
      _id: StringToObjectID(containerId),
      groupId
    });

    if (!foundContainer) {
      return new TRPCError({
        message: 'No container found',
        code: 'BAD_REQUEST'
      })
    }

    await readminCollections.hub_container.deleteOne({
      _id: foundContainer._id
    })
    await readminCollections.hub_resource.deleteMany({
      _id: { $in: foundContainer.resources }
    })

  }),
  removeCover: workspaceProcedure.input(z.object({
    groupId: z.string(),
    resourceId: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const { workspace, user, department } = ctx;
    const { groupId, resourceId } = input;
    if (!department.permissions.admin && !department.permissions?.knowledgeHub?.manage) {
      return new TRPCError({
        message: 'You do not have permission to do this',
        code: 'UNAUTHORIZED'
      })
    }

    const foundResource = await readminCollections.hub_resource.findOne({
      _id: StringToObjectID(resourceId),
      groupId
    });
    if (!foundResource) {
      return new TRPCError({
        message: 'No resource found',
        code: 'BAD_REQUEST'
      })
    }

    await readminCollections.hub_resource.updateOne({
      _id: foundResource._id
    }, {
      $unset: {
        coverImage: 1
      }
    });

    return true;
  }),
  updateResource: workspaceProcedure.input(z.object({
    groupId: z.string(),
    resourceId: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    url: z.string().optional(),
    cover: z.tuple([z.string(), z.string()]).optional(),
    file: z.tuple([z.string(), z.string()]).optional(), // [fileName, base64Data] - replaces URL with CDN file
    removeFile: z.boolean().optional(), // switch back from file to URL mode
  })).mutation(async ({ input, ctx }) => {
    const { workspace, user, department } = ctx;
    const { groupId, resourceId, name, description, url, cover, file, removeFile } = input;
    if (!department.permissions.admin && !department.permissions?.knowledgeHub?.manage) {
      return new TRPCError({
        message: 'You do not have permission to do this',
        code: 'UNAUTHORIZED'
      })
    }

    if (url !== undefined && !removeFile) {
      try {
        new URL(url);
      } catch (e) {
        return new TRPCError({
          message: 'Invalid URL',
          code: 'BAD_REQUEST'
        })
      }
    }

    const foundResource = await readminCollections.hub_resource.findOne({
      _id: StringToObjectID(resourceId),
      groupId
    });
    if (!foundResource) {
      return new TRPCError({
        message: 'No resource found',
        code: 'BAD_REQUEST'
      })
    }

    const toSet: any = {};
    const toUnset: any = {};
    if (name !== undefined) {
      toSet.name = name;
    }
    if (description !== undefined) {
      toSet.description = description;
    }
    if (url !== undefined && !removeFile) {
      toSet.url = url;
    }

    // Handle file upload (replaces URL-based resource with CDN file)
    let newCdnFilePath: string | undefined;
    if (file) {
      const [fileName, fileData] = file;
      const fileId = v4();
      newCdnFilePath = `workspaces/${groupId}/hub/files/${user.dbUser.robloxId}/${fileId}-${fileName}`;
      const buffer = Buffer.from((fileData.split(',') as any)[1], 'base64');
      const ext = fileName.substring(fileName.lastIndexOf('.') + 1);
      const contentType = getMimeByExt(ext);
      await uploadImageBuffer(newCdnFilePath, buffer, contentType, 'private');
      toSet.cdnFilePath = newCdnFilePath;
      toSet.url = '';
    }

    // Handle removing file (switching back to URL mode)
    if (removeFile) {
      toUnset.cdnFilePath = 1;
    }

    const id = v4();
    const coverUrl = cover ? `workspaces/${workspace.groupId}/imgs/${user.dbUser.robloxId}/${id}-${cover[0]}` : foundResource.coverImage;
    if (cover !== undefined) {
      const [fileName, fileData] = cover;
      if (!coverUrl) {
        return new TRPCError({
          message: 'No cover found',
          code: 'BAD_REQUEST'
        });
      }
      await uploadImage(coverUrl, fileName, fileData);
      toSet.coverImage = coverUrl;
    }

    const updateOp: any = { $set: toSet };
    if (Object.keys(toUnset).length > 0) {
      updateOp.$unset = toUnset;
    }

    await readminCollections.hub_resource.updateOne({
      _id: foundResource._id
    }, updateOp)

    // Re-capture thumbnail when URL changes or a new file is uploaded
    if ((url !== undefined && !removeFile) || newCdnFilePath) {
      const suffix = `workspaces/${groupId}/users/${user.dbUser.robloxId}/hub/${foundResource.container}/resource/${foundResource._id.toString()}/capture-updated-${v4()}.png`;

      // Skip screenshot if there's a custom cover image
      if (cover || foundResource.coverImage) {
        await readminCollections.hub_resource.updateOne({
          _id: foundResource._id
        }, {
          $set: {
            previewThumbnail: suffix
          }
        })
        return;
      }

      if (newCdnFilePath) {
        // Generate a short-lived presigned URL and screenshot the file (e.g. PDF viewer)
        const signedUrl = await presignUrl(newCdnFilePath, 60);
        await capturePageScreenshotAndUpload(signedUrl, suffix);
      } else if (url) {
        await capturePageScreenshotAndUpload(url as string, suffix);
      }

      await readminCollections.hub_resource.updateOne({
        _id: foundResource._id
      }, {
        $set: {
          previewThumbnail: suffix
        }
      })
    }

  }),
  deleteResource: workspaceProcedure.input(z.object({
    groupId: z.string(),
    resourceId: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const { workspace, user, department } = ctx;
    const { groupId, resourceId } = input;
    if (!department.permissions.admin && !department.permissions?.knowledgeHub?.manage) {
      return new TRPCError({
        message: 'You do not have permission to do this',
        code: 'UNAUTHORIZED'
      })
    }

    const foundResource = await readminCollections.hub_resource.findOne({
      _id: StringToObjectID(resourceId),
      groupId
    });
    if (!foundResource) {
      return new TRPCError({
        message: 'No resource found',
        code: 'BAD_REQUEST'
      })
    }
    const foundContainer = await readminCollections.hub_container.findOne({
      _id: foundResource.container,
      groupId
    });
    if (!foundContainer) {
      return new TRPCError({
        message: 'No container found',
        code: 'BAD_REQUEST'
      })
    }

    await readminCollections.hub_resource.deleteOne({
      _id: foundResource._id
    })
    await readminCollections.hub_container.updateOne({
      _id: foundContainer._id
    }, {
      $pull: {
        resources: foundResource._id
      }
    })

  }),
  viewOpens: workspaceProcedure.input(z.object({
    groupId: z.string(),
    page: z.number().optional(),
    limit: z.number().optional(),
    search: z.string().optional(),
    sortField: z.enum(['date', '_id', 'url']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })).query(async ({ input, ctx }) => {
    const { workspace, user, department } = ctx;
    const { groupId, limit, page, search, sortField = 'date', sortOrder = 'desc' } = input;
    const newLimit = limit || 10;
    const newSkip = page || 0;

    // Build search filter
    const searchFilters: any[] = [];
    if (search && search.trim()) {
      const trimmedSearch = search.trim();

      // Search by URL (case insensitive partial match)
      searchFilters.push({ url: { $regex: trimmedSearch, $options: 'i' } });

      // Search by username (get matching user IDs)
      try {
        const matchingUsers = await searchRobloxUsersByUsername(trimmedSearch, 20);
        if (matchingUsers.length > 0) {
          searchFilters.push({ userId: { $in: matchingUsers.map(u => u.id.toString()) } });
        }
      } catch (error) {
        // If Roblox search fails, continue with URL search only
        console.warn('Roblox username search failed:', error);
      }
    }

    const filter: Filter<HubResourceOpen> = {
      groupId,
      ...(searchFilters.length > 0 ? { $or: searchFilters } : {})
    };

    // Build sort object
    const sortObj: any = {};
    if (sortField === 'date') {
      sortObj.date = sortOrder === 'asc' ? 1 : -1;
    } else if (sortField === '_id') {
      sortObj._id = sortOrder === 'asc' ? 1 : -1;
    } else if (sortField === 'url') {
      sortObj.url = sortOrder === 'asc' ? 1 : -1;
    }

    const opens = await readminCollections.hub_resource_open.find(filter)
      .sort(sortObj)
      .limit(newLimit)
      .skip(newSkip)
      .toArray();

    const totalOpens = await readminCollections.hub_resource_open.countDocuments(filter);

    return {
      response: opens,
      pagination: {
        page: newSkip,
        pageSize: newLimit,
        total: totalOpens,
        totalPages: Math.ceil(totalOpens / newLimit)
      }
    };
  }),

});
