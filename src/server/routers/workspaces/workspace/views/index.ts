import { v4 } from 'uuid';
import { z } from 'zod';
import { workspacePremiumProcedure } from '~/server/procedures';
import { router } from '~/server/trpc';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import { computeViewData } from './compute';
import proxyFetch from '~/utils/proxyFetch';
import { readminCollections } from '~/services/mongo.service';
import { ViewDownload } from '~/services/NewMongoTypes';
import { ComputedColumn, ConditionalRule, Filter, Sort, ViewColumnConfig } from '~/services/NewMongoTypes/View.type';
import { BrandColors } from '~/services/NewMongoTypes/Workspace.type';
import { env } from '~/services/env';
import { generateView } from '~/services/businessLogic/generateView';
import { presignUrl } from '~/services/CDN-service';
import StringToObjectID from '~/utils/StringToObjectID';


export const workspaceViewsRouter = router({
  compute: computeViewData,
  getViews: workspacePremiumProcedure.input(z.object({
    groupId: z.string()
  })).query(async ({ ctx, input }) => {
    const { department, workspace } = ctx;

    const views = await readminCollections.workspace_view.find({
      groupId: workspace.groupId
    }).toArray();

    return views.map(view => {
      return {
        name: view.name,
        id: view.viewId,
        color: view.color,
        icon: view.icon,
      }
    })

  }),
  create: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string(),
        selectedDepartments: z.array(z.string()),
        selectedFilters: z.array(z.custom<Filter>()),
        selectedSorts: z.array(z.custom<Sort>()),
        color: z.custom<BrandColors>().optional(),
        icon: z.string().optional(),
        computedColumns: z.array(z.custom<ComputedColumn>()).optional(),
        conditionalRules: z.array(z.custom<ConditionalRule>()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, name, selectedDepartments, selectedFilters, selectedSorts, color, icon, computedColumns, conditionalRules } = input;

      if (!department.permissions.reports.export) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must have workspace edit view permission to do this operation',
        );
      }

      const foundDepartments = await readminCollections.department.find({
        _id: { $in: selectedDepartments.map(department => StringToObjectID(department)) }
      }).toArray();

      const newView = await readminCollections.workspace_view.insertOne({
        viewId: v4(),
        groupId,
        name,
        departments: foundDepartments.map(department => department._id),
        filters: selectedFilters,
        sort: selectedSorts,
        color,
        icon,
        computedColumns,
        conditionalRules,
        created: new Date(),
      });

      return await readminCollections.workspace_view.findOne({ _id: newView.insertedId });
    }),
  createDownload: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        viewId: z.string(),
        distributionNum: z.number().nullable(),
        exportType: z.enum(['json', 'csv']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, viewId, distributionNum, exportType } = input;

      if (!department.permissions.reports.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must have workspace see view permission to do this operation',
        );
      }

      const view = readminCollections.workspace_view.findOne({
        groupId,
        viewId
      });

      if (!view) {
        throw ReturnNormalFailure('NOT_FOUND', 'View not found');
      }

      const newViewDownload: ViewDownload = {
        processId: v4(),
        viewId,
        groupId,
        distributionNum,
        exportType,
        created: new Date(),
      };

      await readminCollections.workspace_view_export.insertOne(newViewDownload);


      generateView(newViewDownload.processId.toString());
      // fetch(`${env.NEXT_PUBLIC_VERCEL_ENV == 'production' ? 'https://internal.readmin.app' : env.NEXT_PUBLIC_VERCEL_ENV == 'development' ? 'https://internal.readmin.dev/' : 'http://localhost:4201'}/views/internals/view/generate/${newViewDownload.processId}`, {
      //   method: 'GET',
      // })

      return newViewDownload.processId;
    }),
  checkDownload: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        processId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { processId } = input;

      if (!department.permissions.reports.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must have workspace see view permission to do this operation',
        );
      }

      const newViewDownload = await readminCollections.workspace_view_export.findOne({
        processId
      })
      if (!newViewDownload) {
        throw ReturnNormalFailure('NOT_FOUND', 'View download not found');
      }
      if (newViewDownload?.url) {
        console.log(newViewDownload)
        return {
          ...newViewDownload,
          url: await presignUrl(newViewDownload.url.split('readmin.app/')[1] as string, 60)
        }
      }
      return newViewDownload;
    }),
  get: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        viewId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, viewId } = input;

      if (!department.permissions.reports.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must have workspace view permission to do this operation',
        );
      }

      const view = await readminCollections.workspace_view.findOne({
        groupId,
        viewId
      })
      if (!view) {
        throw ReturnNormalFailure('NOT_FOUND', 'View not found');
      }

      return view;
    }),
  delete: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        viewId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, viewId } = input;

      if (!department.permissions.reports.export) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must have workspace edit view permission to do this operation',
        );
      }

      const view = await readminCollections.workspace_view.findOne({
        groupId,
        viewId
      })
      if (!view) {
        throw ReturnNormalFailure('NOT_FOUND', 'View not found');
      }

      await readminCollections.workspace_view.deleteOne({
        _id: view._id
      })
      await readminCollections.workspace_view_export.deleteMany({
        groupId,
        viewId
      })

      return { success: true };
    }),
  edit: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        viewId: z.string(),
        name: z.string(),
        selectedDepartments: z.array(z.string()),
        selectedFilters: z.array(z.custom<Filter>()),
        selectedSorts: z.array(z.custom<Sort>()),
        color: z.custom<BrandColors>().optional(),
        icon: z.string().optional(),
        computedColumns: z.array(z.custom<ComputedColumn>()).optional(),
        conditionalRules: z.array(z.custom<ConditionalRule>()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      const { groupId, viewId, name, color, icon, computedColumns, conditionalRules } = input;

      if (!department.permissions.reports.export) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must have workspace edit view permission to do this operation',
        );
      }

      const view = await readminCollections.workspace_view.findOne({
        groupId,
        viewId
      })
      if (!view) {
        throw ReturnNormalFailure('NOT_FOUND', 'View not found');
      }

      const foundDepartments = await readminCollections.department.find({
        _id: { $in: input.selectedDepartments.map(department => StringToObjectID(department)) }
      }).toArray();

      await readminCollections.workspace_view.updateOne({
        _id: view._id
      }, {
        $set: {
          name,
          departments: foundDepartments.map(department => department._id),
          filters: input.selectedFilters,
          sort: input.selectedSorts,
          color,
          icon,
          computedColumns,
          conditionalRules,
        }
      })

      return view;
    }),
  // Lightweight update for inline table changes (click-to-sort & column manager)
  // so users don't have to open the full edit form to tweak the table.
  updateMeta: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        viewId: z.string(),
        sort: z.array(z.custom<Sort>()).optional(),
        columns: z.array(z.custom<ViewColumnConfig>()).optional(),
        color: z.custom<BrandColors>().optional(),
        icon: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department } = ctx;
      const { groupId, viewId, sort, columns, color, icon } = input;

      if (!department.permissions.reports.view) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must have workspace view permission to do this operation',
        );
      }

      const view = await readminCollections.workspace_view.findOne({ groupId, viewId });
      if (!view) {
        throw ReturnNormalFailure('NOT_FOUND', 'View not found');
      }

      const update: Record<string, unknown> = {};
      if (sort !== undefined) update.sort = sort;
      if (columns !== undefined) update.columns = columns;
      if (color !== undefined) update.color = color;
      if (icon !== undefined) update.icon = icon;

      if (Object.keys(update).length > 0) {
        await readminCollections.workspace_view.updateOne({ _id: view._id }, { $set: update });
      }

      return await readminCollections.workspace_view.findOne({ _id: view._id });
    }),
});