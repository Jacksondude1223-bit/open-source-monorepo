import { TRPCError } from '@trpc/server';
import { Filter } from 'mongodb';
import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { Response } from '~/services/NewMongoTypes';
import { handleUserApplicationEvent } from '~/services/applications';
import { readminCollections } from '~/services/mongo.service';
import BetterRobloxSearch, {
  getUserGroups,
  getUserInfo,
  getUserThumbnail,
} from '~/services/roblox.service';
import { router } from '~/server/trpc';
import StringToObjectID from '~/utils/StringToObjectID';

export const workspaceFormsApplicationsApplicationResponsesRouter = router({
  getResponses: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        username: z.string().optional(),
        sort: z.enum(['newest', 'oldest']),
        status: z.enum([
          'all',
          'pending',
          'passed',
          'failed',
          'reported',
          'received',
          'read',
          'completed',
          'denied',
          'review',
        ]),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { department } = ctx;
      const { cursor, groupId, applicationId, username, sort, status, limit } =
        input;
      if (!department.permissions.applications.viewApplications && !department.permissions.applications.readApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to view applications.',
        });
      }
      const application = await readminCollections.application.findOne({
        groupId,
        _id: StringToObjectID(applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }

      const responseSearch: Filter<Response> = {
        groupId,
        applicationId,
      };

      if (status != 'all') {
        responseSearch.status = status;
      }

      if (username) {
        responseSearch.userId = {
          $in: await BetterRobloxSearch(username, groupId),
        };
      }

      if (cursor) {
        responseSearch._id =
          sort == 'newest'
            ? {
              $lt: StringToObjectID(cursor),
            }
            : {
              $gt: StringToObjectID(cursor),
            };
      }

      const foundResponses = await readminCollections.response.find(responseSearch, {
        sort: {
          created: sort == 'newest' ? -1 : 1,
        },
        limit
      }).toArray();

      const toSend = await Promise.all(
        foundResponses.map(async (response) => {
          const [userInfo, thumbnail] = await Promise.all([
            getUserInfo(response.userId),
            getUserThumbnail(response.userId),
          ]);
          response.comments = await Promise.all(
            response.comments.map(async (comment: any) => {
              const [userInfo, thumbnail] = await Promise.all([
                getUserInfo(comment.userId),
                getUserThumbnail(comment.userId),
              ]);
              return {
                ...comment,
                ...userInfo,
                thumbnail,
                created: comment.created,
              };
            }),
          );
          return {
            ...response,
            userInfo,
            thumbnail,
          };
        }),
      );

      return toSend;
    }),
  getResponsesCount: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        username: z.string().optional(),
        sort: z.enum(['newest', 'oldest']),
        status: z.enum([
          'all',
          'pending',
          'passed',
          'failed',
          'reported',
          'received',
          'read',
          'completed',
          'denied',
          'review',
        ]),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { department } = ctx;
      const { groupId, applicationId, username, sort, status } = input;
      if (!department.permissions.applications.viewApplications && !department.permissions.applications.readApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to edit applications.',
        });
      }
      const application = await readminCollections.application.findOne({
        groupId,
        _id: StringToObjectID(applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }

      const responseSearch: Filter<Response> = {
        groupId,
        applicationId,
      };

      if (status != 'all') {
        responseSearch.status = status;
      }

      if (username) {
        responseSearch.userId = {
          $in: await BetterRobloxSearch(username, groupId),
        };
      }

      const foundResponsesTotal = await readminCollections.response.countDocuments(responseSearch);

      return foundResponsesTotal;
    }),
  getComments: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        responseId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { department } = ctx;
      const { groupId, applicationId, responseId } = input;
      if (!department.permissions.applications.viewApplications && !department.permissions.applications.readApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to read applications.',
        });
      }
      const application = await readminCollections.application.findOne({
        groupId,
        _id: StringToObjectID(applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }
      const foundResponse = await readminCollections.response.findOne({
        _id: StringToObjectID(responseId),
        applicationId,
        groupId,
      });
      if (!foundResponse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }

      return await Promise.all(
        foundResponse.comments.map(async (comment: any) => {
          const [userInfo, thumbnail] = await Promise.all([
            getUserInfo(comment.userId),
            getUserThumbnail(comment.userId),
          ]);
          return {
            ...comment,
            ...userInfo,
            thumbnail,
            created: comment.created,
          };
        }),
      );
    }),
  getUserInfo: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        responseId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { department } = ctx;
      const { groupId, applicationId, responseId } = input;
      if (!department.permissions.applications.viewApplications && !department.permissions.applications.readApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to read applications.',
        });
      }
      const application = await readminCollections.application.findOne({
        groupId,
        _id: StringToObjectID(applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }
      const foundResponse = await readminCollections.response.findOne({
        _id: StringToObjectID(responseId),
        applicationId,
        groupId,
      });
      if (!foundResponse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }

      const userId = foundResponse.userId;

      const [
        workspacePunishments,
        RobloxInfo,
        Groups,
        FriendsReq,
        FollowersReq,
        PastUsernamesReq,
      ] = await Promise.all([
        readminCollections.write_ups.countDocuments({
          groupId,
          userId: parseInt(userId),
        }),
        getUserInfo(userId),
        getUserGroups(userId),
        fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
        fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
        fetch(
          `https://users.roblox.com/v1/users/${userId}/username-history?limit=10&sortOrder=Asc`,
        ),
      ]);
      const [Friends, Followers, PastUsernames] = await Promise.all([
        FriendsReq.json(),
        FollowersReq.json(),
        PastUsernamesReq.json(),
      ]);

      return [
        {
          name: 'Group Role',
          value:
            Groups?.find((a) => a.group.id.toString() == groupId)?.role.name ||
            'Guest',
        },
        {
          name: 'Roblox ID',
          value: RobloxInfo?.id,
        },
        {
          name: 'Friends',
          value: (Friends as {count: number;})?.count?.toLocaleString(),
        },
        {
          name: 'Followers',
          value: (Followers as {count: number;})?.count?.toLocaleString(),
        },
        {
          name: 'Past Usernames',
          value: (PastUsernames as {data: {name: string}[]})?.data
            ?.map((a: { name: string }) => a.name)
            ?.join(', '),
        },
        {
          name: 'Workspace Punishments',
          value: workspacePunishments.toLocaleString(),
        },
        {
          name: 'Roblox Created',
          value: `${new Date(
            //@ts-expect-error chill
            RobloxInfo?.created,
          ).toLocaleDateString()} - ${Math.floor(
            //@ts-expect-error chill
            new Date(new Date() - new Date(RobloxInfo?.created)).getTime() /
            (1000 * 60 * 60 * 24),
          ).toLocaleString()} days`,
        },
        {
          name: 'Groups',
          value: Groups?.map((a) => a.group.name).join(', ') || '',
        },
      ];
    }),
  commentOnApplication: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        responseId: z.string(),
        message: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { department } = ctx;
      const { groupId, applicationId, responseId, message } = input;
      if (!department.permissions.applications.readApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to read applications.',
        });
      }
      const application = await readminCollections.application.findOne({
        groupId,
        _id: StringToObjectID(applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }
      const foundResponse = await readminCollections.response.findOne({
        _id: StringToObjectID(responseId),
        applicationId,
        groupId,
      });
      if (!foundResponse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }

      if (!ctx.user.roblox?.id) {
        return;
      }

      await readminCollections.response.updateOne({
        _id: foundResponse._id,
      }, {
        $push: {
          comments: {
            message,
            userId: ctx.user.roblox?.id.toString(),
            created: new Date(),
          }
        }
      })

      return true;
    }),
  setResponseStatus: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        responseId: z.string(),
        status: z.enum([
          'pending',
          'passed',
          'reported',
          'failed',
          'received',
          'read',
          'completed',
          'denied',
          'review',
        ]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { department } = ctx;
      const { groupId, applicationId, responseId, status } = input;
      if (!department.permissions.applications.readApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to read applications.',
        });
      }
      const application = await readminCollections.application.findOne({
        groupId,
        _id: StringToObjectID(applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }
      const foundResponse = await readminCollections.response.findOne({
        _id: StringToObjectID(responseId),
        applicationId,
        groupId,
      });
      if (!foundResponse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found.',
        });
      }
      const oldStatus = JSON.parse(JSON.stringify(foundResponse.status)); // dereference

      if (!ctx.user.roblox?.id) {
        return;
      }

      await readminCollections.response.updateOne({
        _id: foundResponse._id,
      }, {
        $push: {
          comments: {
            message: `Set application status to ${status}`,
            userId: ctx.user.roblox?.id.toString(),
            created: new Date(),
          }
        },
        $set: {
          status,
        }
      });

      handleUserApplicationEvent(groupId, applicationId, responseId, oldStatus, status);
      return true;
    }),
  markResponseRead: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        applicationId: z.string(),
        responseId: z.string(),
        read: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { department } = ctx;
      const { groupId, applicationId, responseId, read } = input;
      if (!department.permissions.applications.readApplications) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User is not permitted to read applications.',
        });
      }
      const foundResponse = await readminCollections.response.findOne({
        _id: StringToObjectID(responseId),
        applicationId,
        groupId,
      });
      if (!foundResponse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Response not found.',
        });
      }

      await readminCollections.response.updateOne(
        { _id: foundResponse._id },
        { $set: { read } },
      );

      return true;
    }),
});
