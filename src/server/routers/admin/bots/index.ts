import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { founderProcedure } from '~/server/procedures';
import { decrypt, encrypt } from '~/services/Crypto-service.service';
import { readminCollections } from '~/services/mongo.service';
import { getAuthenticatedUserInfo } from '~/services/roblox.service';
import { router } from '~/server/trpc';
import StringToObjectID from '~/utils/StringToObjectID';

export const adminBotsRouter = router({
  getPendingLogins: founderProcedure.query(async ({ ctx }) => {
    const bots = await readminCollections.roblox_bots.find({ loggedIn: false }).toArray();
    return bots.map(a => {
      return { ...a, password: decrypt(a.password) }
    });
  }),

  loginBot: founderProcedure.input(z.object({
    botId: z.string(),
    cookie: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { botId, cookie } = input;

    const bot = await readminCollections.roblox_bots.findOne({ _id: StringToObjectID(botId) });
    if (!bot) return new TRPCError({ code: 'BAD_REQUEST', message: 'Bot not found' });

    const userInfo = await getAuthenticatedUserInfo(cookie);
    if (!userInfo || typeof (userInfo) == 'string') return new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid cookie' });
    if (userInfo?.id !== bot.userId) return new TRPCError({ code: 'BAD_REQUEST', message: 'User ID mismatch, wrong cookie.' });

    await readminCollections.roblox_bots.updateOne({ _id: bot._id }, {
      $set: {
        cookie: encrypt(cookie),
        loggedIn: true,
        pendingLogin: false
      }
    });


    return { success: true }
  }),
  removeBot: founderProcedure.input(z.object({
    botId: z.string()
  })).mutation(async ({ ctx, input }) => {
    const { botId } = input;
    const bot = await readminCollections.roblox_bots.findOne({ _id: StringToObjectID(botId) });
    if (!bot) return new TRPCError({ code: 'BAD_REQUEST', message: 'Bot not found' });

    await readminCollections.roblox_bots.deleteOne({ _id: bot._id });

    return { success: true }
  }),

})