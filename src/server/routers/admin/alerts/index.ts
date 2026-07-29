import { z } from 'zod';
import { founderProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { router } from '~/server/trpc';
import StringToObjectID from '~/utils/StringToObjectID';

export const adminAlertsRouter = router({
  getAlerts: founderProcedure.query(async ({ ctx }) => {
    const { user } = ctx;

    const alerts = await readminCollections.site_alert.find({}).toArray();
    return alerts;
  }),
  deleteAlert: founderProcedure.input(z.object({
    id: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { user } = ctx;

    const { id } = input;

    await readminCollections.site_alert.deleteOne({ _id: StringToObjectID(id) });

    return;
  }),
  createAlert: founderProcedure.input(z.object({
    notif: z.object({
      id: z.string(),
      type: z.union([z.literal('primary'), z.literal('warning'), z.literal('danger')]),
      title: z.string().optional(),
      message: z.string(),
      link: z.string().optional(),
      linkMessage: z.string().optional(),
      closable: z.boolean().optional(),
      public: z.boolean(),
      groupIds: z.array(z.string()).optional(),
      userIds: z.array(z.string()).optional(),
      created: z.date(),
    })
  })).mutation(async ({ ctx, input }) => {
    const { user } = ctx;

    const { notif } = input;

    await readminCollections.site_alert.insertOne(notif);

    return;
  }),
  updateAlert: founderProcedure.input(z.object({
    id: z.string(),
    notif: z.object({
      id: z.string(),
      type: z.union([z.literal('primary'), z.literal('warning'), z.literal('danger')]),
      title: z.string().optional(),
      message: z.string(),
      link: z.string().optional(),
      linkMessage: z.string().optional(),
      closable: z.boolean().optional(),
      public: z.boolean(),
      groupIds: z.array(z.string()).optional(),
      userIds: z.array(z.string()).optional(),
      created: z.date(),
    })
  })).mutation(async ({ ctx, input }) => {
    const { user } = ctx;

    const { id, notif } = input;
    await readminCollections.site_alert.updateOne({ _id: StringToObjectID(id) }, { $set: { ...notif, created: new Date(notif.created) } });

    return;
  })
})