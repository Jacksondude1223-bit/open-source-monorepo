import { v4 } from 'uuid';
import { z } from 'zod';
import { workspacePremiumProcedure } from '~/server/procedures';
import { presignArrayOfPaths, presignUrl, uploadImage } from '~/services/CDN-service';
import { Game, RunningGamePlayers, RunningGames, Session, SessionRoles } from '~/services/NewMongoTypes';
import { createDiscordEvent, returnDiscordMessageFormatForDate, sendReAdminInternalWebhookMessage, sendWebhookMessage } from '~/services/discord.service';
import { readminCollections } from '~/services/mongo.service';
import { getUserInfo, getUserThumbnail } from '~/services/roblox.service';
import { router } from '~/server/trpc';
import { DaysInWeek, DaysInWeek_TYPE, addMinutesToDate, getEndOfDay, getStartOfDay } from '~/utils/DateUtils';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import StringToObjectID from '~/utils/StringToObjectID';
import fetchImageAsBase64 from '~/utils/fetchImageAsBase64';
import moment from 'moment-timezone';
import { ObjectId } from 'mongodb';
import { SessionClaim, SessionClaimV2 } from '~/services/NewMongoTypes/Session.type';
import { isUserGDPRIgnored } from '~/utils/isUserGDPRIgnored';
import { writeClaimReleaseAudit } from '~/services/businessLogic/writeClaimReleaseAudit';


interface SpecialServerReturn extends Session {
  game: Game;
}
interface RunningServerSessionType extends RunningGames {
  runningPlayers: RunningGamePlayers[];
}

async function updateAllServerClaimsForSession(oldSession: Session) {
  let usersInClaim: string[] = [];
  const session = await readminCollections.session.findOne({ _id: oldSession._id }) as Session;
  if (session.newClaimingSystem) {
    const servers = Object.keys(session.servers);
    for (const server of servers) {
      if (!session.servers[server]) {
        continue;
      }
      const claims = session.servers[server].claims as SessionClaimV2[];
      for (const claim of claims) {
        if (usersInClaim.includes(claim.userId) == false) {
          usersInClaim.push(claim.userId);
        }
      }
    }
  } else {
    const servers = Object.keys(session.servers);
    for (const server of servers) {
      if (!session.servers[server]) {
        continue;
      }
      const claims = session.servers[server].claims as { [userId: string]: SessionClaim };
      for (const claim of Object.keys(claims)) {
        if (usersInClaim.includes(claim) == false) {
          usersInClaim.push(claim);
        }
      }
    }
  }
  await readminCollections.session.updateOne({ _id: session._id }, {
    $set: { claims: usersInClaim }
  });
}

export const workspaceSessionsV2Router = router({
  getTemplates: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      const { } = input;
      const allSessions = await readminCollections.sessions_template.find({ groupId: workspace.groupId }).toArray();
      return allSessions;
    }),
  getSchedule: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        weekOf: z.array(z.number()),
        tz: z.string()
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      const { weekOf, tz } = input;
      const week = weekOf.map(a => new Date(a));
      const templates = await readminCollections.sessions_template.find({ groupId: workspace.groupId }).toArray();
      let sessions: { [day: string]: SpecialServerReturn[] } = {};

      for (const dayOfWeek of week) {
        let addedThisDay = [];


        const sessionsThisDay = await readminCollections.session.find({
          groupId: workspace.groupId,
          date: {
            $gte: getStartOfDay(dayOfWeek, tz),
            $lte: getEndOfDay(dayOfWeek, tz)
          }
        }).toArray();

        // Get the day of week in the user's timezone, not local timezone
        // The dayOfWeek comes from the client as UTC, so we need to convert it to the target timezone
        const dayInTz = moment(dayOfWeek).tz(tz);
        const day = DaysInWeek[dayInTz.day()] as DaysInWeek_TYPE;

        for (const template of templates) {
          if (template.schedule.type == 'daily') {
            // Template hours are in UTC. Try the UTC hour on the day before, same day, and day after
            // to find which one lands on the target day when converted to user's timezone
            for (const dayOffset of [-1, 0, 1]) {
              const utcMoment = moment.utc()
                .year(dayInTz.year())
                .month(dayInTz.month())
                .date(dayInTz.date() + dayOffset)
                .hour(template.schedule.hour)
                .minute(template.schedule.minute)
                .second(0)
                .millisecond(0);
              
              // Check if this UTC time falls on the target day in user's timezone
              const inUserTz = utcMoment.clone().tz(tz);
              
              if (inUserTz.year() === dayInTz.year() &&
                  inUserTz.month() === dayInTz.month() &&
                  inUserTz.date() === dayInTz.date()) {
                const starts = utcMoment.toDate();

                const endsAt = new Date(new Date(starts).getTime() + template.sessionDuration * 60 * 1000);
                const notifyTime = new Date(new Date(starts).getTime() - template.appearsMinutesBefore * 60 * 1000);

                const foundMatch = sessionsThisDay.find(session => new Date(session.date).getTime() === starts.getTime());
                if (!foundMatch) {
                  addedThisDay.push({ ...template, _id: 'notCreated', date: starts, endsAt, notifyTime, template });
                }
                break; // Found the right day, no need to check other offsets
              }
            }
          }
          if (
            template.schedule.type == 'weekly' &&
            template.schedule.day == day.toLowerCase()
          ) {
            // Template hours are in UTC. Try the UTC hour on the day before, same day, and day after
            // to find which one lands on the target day when converted to user's timezone
            for (const dayOffset of [-1, 0, 1]) {
              const utcMoment = moment.utc()
                .year(dayInTz.year())
                .month(dayInTz.month())
                .date(dayInTz.date() + dayOffset)
                .hour(template.schedule.hour)
                .minute(template.schedule.minute)
                .second(0)
                .millisecond(0);
              
              // Check if this UTC time falls on the target day in user's timezone
              const inUserTz = utcMoment.clone().tz(tz);
              
              if (inUserTz.year() === dayInTz.year() &&
                  inUserTz.month() === dayInTz.month() &&
                  inUserTz.date() === dayInTz.date()) {
                const starts = utcMoment.toDate();

                const endsAt = new Date(new Date(starts).getTime() + template.sessionDuration * 60 * 1000);
                const notifyTime = new Date(new Date(starts).getTime() - template.appearsMinutesBefore * 60 * 1000);

                const foundMatch = sessionsThisDay.find(session => new Date(session.date).getTime() === starts.getTime());
                if (!foundMatch) {
                  addedThisDay.push({ ...template, _id: 'notCreated', date: starts, endsAt, notifyTime, template });
                }
                break; // Found the right day, no need to check other offsets
              }
            }
          }
        }


        for (const existingSession of sessionsThisDay) {
          // Check if this session is already created by a template, or if it is unique.
          const foundMatch = addedThisDay.find(session => (session?.date as Date) == existingSession.date);
          if (!foundMatch) {
            addedThisDay.push(existingSession);
          }
        }

        addedThisDay = await Promise.all(addedThisDay.map(async session => {
          const game = await readminCollections.game.findOne({ groupId: session.groupId, placeId: session.template.placeId });
          return {
            ...session,
            game
          }
        }))

        //@ts-expect-error good enough for gov work
        sessions[dayOfWeek.getTime()] = addedThisDay.sort((a, b) => a.date.getTime() - b.date.getTime());

      }

      return sessions;
    }),
  getScheduleForDate: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        date: z.date(),
        tz: z.string()
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, department } = ctx;
      const { date, tz } = input;
      const templates = await readminCollections.sessions_template.find({ groupId: workspace.groupId }).toArray();
      let sessions: SpecialServerReturn[] = [];
      const dayOfWeek = date;

      let addedThisDay = [];


      const sessionsThisDay = await readminCollections.session.find({
        groupId: workspace.groupId,
        date: {
          $gte: getStartOfDay(dayOfWeek, tz),
          $lte: getEndOfDay(dayOfWeek, tz)
        }
      }).toArray();

      for (const session of sessionsThisDay) {
        session.claims = await Promise.all(session.claims.map(async claim => {
          return await getUserThumbnail(claim);
        }));
      }

      // Get the day of week in the user's timezone, not local timezone
      // The dayOfWeek comes from the client as UTC, so we need to convert it to the target timezone
      const dayInTz = moment(dayOfWeek).tz(tz);
      const day = DaysInWeek[dayInTz.day()] as DaysInWeek_TYPE;

      for (const template of templates) {
        if (template.schedule.type == 'daily') {
          // Template hours are in UTC. Try the UTC hour on the day before, same day, and day after
          // to find which one lands on the target day when converted to user's timezone
          for (const dayOffset of [-1, 0, 1]) {
            const utcMoment = moment.utc()
              .year(dayInTz.year())
              .month(dayInTz.month())
              .date(dayInTz.date() + dayOffset)
              .hour(template.schedule.hour)
              .minute(template.schedule.minute)
              .second(0)
              .millisecond(0);
            
            // Check if this UTC time falls on the target day in user's timezone
            const inUserTz = utcMoment.clone().tz(tz);
            
            if (inUserTz.year() === dayInTz.year() &&
                inUserTz.month() === dayInTz.month() &&
                inUserTz.date() === dayInTz.date()) {
              const starts = utcMoment.toDate();

              const endsAt = new Date(new Date(starts).getTime() + template.sessionDuration * 60 * 1000);
              const notifyTime = new Date(new Date(starts).getTime() - template.appearsMinutesBefore * 60 * 1000);

              const foundMatch = sessionsThisDay.find(session => new Date(session.date).getTime() === starts.getTime());
              if (!foundMatch) {
                addedThisDay.push({ ...template, _id: 'notCreated', date: starts, endsAt, notifyTime, template });
              }
              break; // Found the right day, no need to check other offsets
            }
          }
        }
        if (
          template.schedule.type == 'weekly' &&
          template.schedule.day == day.toLowerCase()
        ) {
          // Template hours are in UTC. Try the UTC hour on the day before, same day, and day after
          // to find which one lands on the target day when converted to user's timezone
          for (const dayOffset of [-1, 0, 1]) {
            const utcMoment = moment.utc()
              .year(dayInTz.year())
              .month(dayInTz.month())
              .date(dayInTz.date() + dayOffset)
              .hour(template.schedule.hour)
              .minute(template.schedule.minute)
              .second(0)
              .millisecond(0);
            
            // Check if this UTC time falls on the target day in user's timezone
            const inUserTz = utcMoment.clone().tz(tz);
            
            if (inUserTz.year() === dayInTz.year() &&
                inUserTz.month() === dayInTz.month() &&
                inUserTz.date() === dayInTz.date()) {
              const starts = utcMoment.toDate();

              const endsAt = new Date(new Date(starts).getTime() + template.sessionDuration * 60 * 1000);
              const notifyTime = new Date(new Date(starts).getTime() - template.appearsMinutesBefore * 60 * 1000);

              const foundMatch = sessionsThisDay.find(session => new Date(session.date).getTime() === starts.getTime());
              if (!foundMatch) {
                addedThisDay.push({ ...template, _id: 'notCreated', date: starts, endsAt, notifyTime, template });
              }
              break; // Found the right day, no need to check other offsets
            }
          }
        }
      }


      for (const existingSession of sessionsThisDay) {
        // Check if this session is already created by a template, or if it is unique.
        const foundMatch = addedThisDay.find(session => (session?.date as Date) == existingSession.date);
        if (!foundMatch) {
          addedThisDay.push(existingSession);
        }
      }

      addedThisDay = await Promise.all(addedThisDay.map(async session => {
        const game = await readminCollections.game.findOne({ groupId: session.groupId, placeId: session.template.placeId });
        return {
          ...session,
          game
        }
      }))

      //@ts-expect-error good enough for gov work
      sessions = addedThisDay.sort((a, b) => a.date.getTime() - b.date.getTime());



      return sessions;
    }),
  getExistingSessionOrCreate: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        startsAt: z.date()
      }),
    ).mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, sessionId, startsAt } = input;

      const session = await readminCollections.sessions_template.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }

      let existingSession = await readminCollections.session.findOne({ groupId, templateId: session._id, date: startsAt });
      if (!existingSession) {
        await readminCollections.session.insertOne({
          groupId,
          id: v4(),
          templateId: session._id,
          comments: [],
          servers: {},
          claims: [],
          attendees: [],
          date: startsAt,
          endsAt: addMinutesToDate(startsAt, session.sessionDuration == 0 ? 60 : session.sessionDuration),
          notifyTime: new Date(new Date(startsAt).getTime() - session.appearsMinutesBefore * 60 * 1000),
          created: new Date(),
          createdBy: user.dbUser.robloxId,
          template: session,
          oneOffSession: false,
          sentDMS: false,
          sentStartMessage: false,
          sentEndMessage: false,
          newClaimingSystem: true,
        });
        existingSession = await readminCollections.session.findOne({ groupId, templateId: session._id, date: startsAt });


        const foundLoggingMechanisms = await readminCollections.discord_logging.find({
          groupId: workspace.groupId,
          event: { $in: ['all', 'session-create'] }
        }).toArray();

        for (const loggingMechanism of foundLoggingMechanisms) {
          const url = loggingMechanism.webhookUrl;
          const userInfo = await getUserInfo(user?.dbUser?.robloxId?.toString() || '1');
          const userThumbnail = await getUserThumbnail(user?.dbUser?.robloxId?.toString() || '1');
          const desc = `${userInfo?.name} created a new session on ${startsAt.toLocaleString()} for ${session.name}`;
          await sendWebhookMessage(url, 'blue', 'Session Created', desc, userThumbnail)
        }

      }
      return existingSession as Session & { _id: ObjectId };
    }),
  getSessionData: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string()
      }),
    ).query(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, sessionId } = input;


      const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }
      const roles = await readminCollections.session_roles.find({ groupId: workspace.groupId, id: { $in: session.template.roles } }).toArray();
      const runningServers: RunningServerSessionType[] = [];
      for (const serverId of Object.keys(session.servers)) {
        const server = session.servers[serverId];
        if (server?.linkedToServer) {
          //@ts-expect-error it do exist.
          const game = await readminCollections.running_games.findOne({ _id: server.linkedServerReAdminId });
          if (game) {
            const runningPlayers = await readminCollections.running_game_players.find({ runningGameId: game._id }).toArray();
            runningServers.push({ ...game, runningPlayers });
          }
        }
      }
      return { session, roles, runningServers };
    }),
  createSessionServer: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
      }),
    ).mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, sessionId } = input;

      const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }
      const template = session.template;
      if (!template) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Template not found');
      }

      await readminCollections.session.updateOne({ _id: session._id }, {
        $set: {
          [`servers.${v4()}`]: {
            linkedToServer: false,
            claims: [],
            attendees: {}
          }
        }
      });


      const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: workspace.groupId,
        event: { $in: ['all', 'session-server-created'] }
      }).toArray();

      for (const loggingMechanism of foundLoggingMechanisms) {
        const url = loggingMechanism.webhookUrl;
        const userInfo = await getUserInfo(user?.dbUser?.robloxId?.toString() || '1');
        const userThumbnail = await getUserThumbnail(user?.dbUser?.robloxId?.toString() || '1');
        const desc = `${userInfo?.name} created a new server for ${template.name} on ${returnDiscordMessageFormatForDate(session.date, 'long_date/time')}`;
        await sendWebhookMessage(url, 'blue', 'Session Server Created', desc, userThumbnail)
      }

      return {};
    }),
  updateSessionServerName: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        serverId: z.string(),
        name: z.string(),
      }),
    ).mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, sessionId, serverId, name } = input;

      const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }

      await readminCollections.session.updateOne({ _id: session._id }, {
        $set: {
          [`servers.${serverId}.nickname`]: name
        }
      });
      return {};
    }),
  linkSessionServerToUsersServer: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        serverId: z.string()
      }),
    ).mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, sessionId, serverId } = input;

      const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }
      const template = await readminCollections.sessions_template.findOne({ groupId, _id: session.templateId as ObjectId });
      if (!template) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Template not found');
      }
      const runningGames = await readminCollections.running_games.find({ groupId: workspace.groupId, placeId: template.placeId }).toArray();
      if (!runningGames) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Game not found');
      }

      const foundPlayer = await readminCollections.running_game_players.findOne({
        groupId: workspace.groupId,
        userId: user.dbUser.robloxId,
        runningGameId: { $in: runningGames.map(game => game._id) }
      });

      if (foundPlayer == null) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Player not in any servers');
      }
      const server = runningGames.find(runningGame => runningGame?._id?.toString() == foundPlayer?.runningGameId?.toString()) as RunningGames;
      await readminCollections.session.updateOne({ _id: session._id }, {
        $set: {
          [`servers.${serverId}.linkedToServer`]: true,
          [`servers.${serverId}.linkedServerGameId`]: server._id,
          [`servers.${serverId}.linkedServerJobId`]: server.jobId,
          [`servers.${serverId}.linkedByUser`]: user.dbUser.robloxId,
        }
      });
      return {};
    }),
  deleteSessionServer: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        serverId: z.string(),
      }),
    ).mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, sessionId, serverId } = input;

      const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }
      const template = session.template;
      if (!template) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Template not found');
      }

      await readminCollections.session.updateOne({ _id: session._id }, {
        $unset: { [`servers.${serverId}`]: '' },
      });

      // update session.claims to only be the user ids who have claims in the remaining servers
      const remainingServers = Object.keys(session.servers).filter(s => s !== serverId);
      const remainingClaims: string[] = [];
      for (const remainingServer of remainingServers) {
        const serverClaims = session.servers[remainingServer]?.claims || [];
        if (Array.isArray(serverClaims)) {
          for (const claim of serverClaims) {
            if (!remainingClaims.includes(claim.userId)) {
              remainingClaims.push(claim.userId);
            }
          }
        } else {
          for (const claim of Object.keys(serverClaims)) {
            if (!remainingClaims.includes(claim)) {
              remainingClaims.push(claim);
            }
          }
        }
      }
      await readminCollections.session.updateOne({ _id: session._id }, {
        $set: { claims: remainingClaims }
      });



      const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: workspace.groupId,
        event: { $in: ['all', 'session-server-deleted'] }
      }).toArray();

      for (const loggingMechanism of foundLoggingMechanisms) {
        const url = loggingMechanism.webhookUrl;
        const userInfo = await getUserInfo(user?.dbUser?.robloxId?.toString() || '1');
        const userThumbnail = await getUserThumbnail(user?.dbUser?.robloxId?.toString() || '1');
        const desc = `${userInfo?.name} deleted server ${session.servers[serverId]?.nickname || serverId} for ${template.name} on ${returnDiscordMessageFormatForDate(session.date, 'long_date/time')}`;
        await sendWebhookMessage(url, 'blue', 'Session Server Deleted', desc, userThumbnail)
      }


      return {};
    }),


  // Session Claiming
  claimSessionRoleForServer: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        serverId: z.string(),
        roleId: z.string(),
        subroleId: z.string(),
        userId: z.string()
      }),
    ).mutation(async ({ ctx, input }) => {
      const { workspace, department, user, userRole } = ctx;
      const { groupId, sessionId, serverId, roleId, subroleId, userId } = input;

      const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }

      const server = session.servers[serverId];
      if (!server) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Server not found');
      }

      const template = session.template;
      if (!template) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Template not found');
      }

      const role = await readminCollections.session_roles.findOne({ groupId, id: roleId });
      if (!role) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Role not found');
      }

      const subrole = role.roles.find(r => r.id == subroleId);
      if (!subrole) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Subrole not found');
      }

      if (session?.newClaimingSystem) {
        const thisRoleClaims = Array.isArray(server.claims) ? server.claims : Object.values(server.claims);
        const alreadyClaimed = thisRoleClaims.filter(claim => claim.claimedRole == role.id);
        const userRequirement = (subrole.maxUsers == 0 ? true : alreadyClaimed.length < subrole.maxUsers);
        const canCreateNotAdmin = userRequirement && (subrole.minRank == 0 ? true : parseInt(userRole?.rank?.toString() || '0') >= subrole.minRank);

        const canCreate = department.permissions.admin ? userRequirement ? true : false : canCreateNotAdmin;

        if (!canCreate) {
          throw ReturnNormalFailure('BAD_REQUEST', 'You cannot claim this role');
        }

        //aaroIyn
        await readminCollections.session.updateOne({
          _id: session._id
        }, {
          $push: {
            [`servers.${serverId}.claims`]: {
              userId,
              claimedRole: subrole.id,
              claimedBy: user.dbUser.robloxId,
              claimedAt: new Date(),
              state: 'none',
              claimId: v4(),
            }
          }
        });

      } else {

        const claimOnce = subrole.claimOnce; // only used for update
        const thisRoleClaims = Array.isArray(server.claims)
          ? []
          : Object.keys(server.claims || {}).filter((claim) => (server.claims as { [userId: string]: SessionClaim })[claim]?.claimedRole == role.id);
        const alreadyClaimed = thisRoleClaims.length != 0;
        const userRequirement = (subrole.maxUsers == 0 ? true : thisRoleClaims.length < subrole.maxUsers);
        const canCreateNotAdmin = userRequirement && (subrole.minRank == 0 ? true : parseInt(userRole?.rank?.toString() || '0') >= subrole.minRank);

        const canCreate = department.permissions.admin ? userRequirement ? true : false : canCreateNotAdmin;

        if (!canCreate) {
          throw ReturnNormalFailure('BAD_REQUEST', 'You cannot claim this role');
        }

        await readminCollections.session.updateOne({
          _id: session._id
        }, {
          $set: {
            [`servers.${serverId}.claims.${userId}`]: {
              claimedRole: subrole.id,
              claimedBy: user.dbUser.robloxId,
              claimedAt: new Date(),
              state: 'none',
              claimId: v4(),
            }
          }
        })

      }

      await updateAllServerClaimsForSession(session);


      if (template.createDiscordEvent && session.createdDiscordEvent !== true) {
        const game = await readminCollections.game.findOne({ groupId, placeId: template.placeId })
        const discordIntergration = await readminCollections.discord_bots.findOne({ groupId });
        if (discordIntergration) {
          await createDiscordEvent({
            guildId: discordIntergration.guildId,
            name: template.name,
            location: `https://roblox.com/games/${game?.placeId}/${game?.name.split(' ').join('-')}`,
            scheduled_start_time: session.date,
            scheduled_end_time: addMinutesToDate(session.date, template.sessionDuration == 0 ? 60 : template.sessionDuration),
            entity_type: 3,
            image: await fetchImageAsBase64(game?.images?.thumbnail || 'https://t3.rbxcdn.com/3a2f877d534961358c99e018f3bdbd4b'),
            description: template.description
          })
          await readminCollections.session.updateOne({
            _id: session._id
          },
            {
              $set: { createdDiscordEvent: true }
            });
        }
      }

      const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: workspace.groupId,
        event: { $in: ['all', 'session-role-claimed'] }
      }).toArray();

      for (const loggingMechanism of foundLoggingMechanisms) {
        const url = loggingMechanism.webhookUrl;
        const userInfo = await getUserInfo(user?.dbUser?.robloxId?.toString() || '1');
        const claimedUser = await getUserInfo(userId?.toString() || '1');
        const userThumbnail = await getUserThumbnail(user?.dbUser?.robloxId?.toString() || '1');
        const desc = `User: ${userInfo?.name}
    \nClaimed Role: ${subrole?.name || template.name} for ${claimedUser?.name || userId}
    \nSession name: ${session.template.name}
    \nStart Time: ${returnDiscordMessageFormatForDate(session.date, 'long_date/time')}`;
        await sendWebhookMessage(url, 'blue', 'Session Claimed', desc, userThumbnail)
      }


      return {};
    }),
  updateClaimSessionRoleForServer: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        serverId: z.string(),
        roleId: z.string(),
        subroleId: z.string(),
        oldUserId: z.string(),
        userId: z.string(),
        claimId: z.string().optional()
      }),
    ).mutation(async ({ ctx, input }) => {
      const { workspace, department, user, userRole } = ctx;
      const { groupId, sessionId, serverId, roleId, subroleId, userId, claimId } = input;
      if (await isUserGDPRIgnored(userId)) {
        throw ReturnNormalFailure('BAD_REQUEST', 'User is GDPR ignored');
      }

      const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }

      const server = session.servers[serverId];
      if (!server) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Server not found');
      }

      const template = session.template;
      if (!template) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Template not found');
      }

      const role = await readminCollections.session_roles.findOne({ groupId, id: roleId });
      if (!role) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Role not found');
      }

      const subrole = role.roles.find(r => r.id == subroleId);
      if (!subrole) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Subrole not found');
      }

      if (session?.newClaimingSystem) {
        const thisRoleClaims = Array.isArray(server.claims) ? server.claims : Object.values(server.claims);
        const alreadyClaimed = thisRoleClaims.filter(claim => claim.claimedRole == role.id);
        const userRequirement = (subrole.maxUsers == 0 ? true : alreadyClaimed.length < subrole.maxUsers);
        const canCreateNotAdmin = userRequirement && (subrole.minRank == 0 ? true : parseInt(userRole?.rank?.toString() || '0') >= subrole.minRank);

        const canCreate = department.permissions.admin ? userRequirement ? true : false : canCreateNotAdmin;

        if (!canCreate) {
          throw ReturnNormalFailure('BAD_REQUEST', 'You cannot claim this role');
        }

        await readminCollections.session.updateOne({
          _id: session._id,
          [`servers.${serverId}.claims.claimId`]: claimId
        }, {
          $set: {
            [`servers.${serverId}.claims.$.userId`]: userId,
            [`servers.${serverId}.claims.$.claimedRole`]: subrole.id,
            [`servers.${serverId}.claims.$.claimedBy`]: user.dbUser.robloxId,
            [`servers.${serverId}.claims.$.claimedAt`]: new Date(),
            [`servers.${serverId}.claims.$.state`]: 'none'
          }
        });
      } else {

        const claimOnce = subrole.claimOnce; // only used for update
        const thisRoleClaims = Object.keys(server?.claims || {}).filter((userId) => (server.claims as { [userId: string]: SessionClaim })[userId]?.claimedRole == role.id);
        const userRequirement = (subrole.maxUsers == 0 ? true : thisRoleClaims.length < subrole.maxUsers);
        const canCreateNotAdmin = userRequirement && (subrole.minRank == 0 ? true : parseInt(userRole?.rank?.toString() || '0') >= subrole.minRank);


        if (claimOnce && !(department.permissions.admin || department.permissions.sessions.manage)) {
          throw ReturnNormalFailure('BAD_REQUEST', 'You cannot claim this role');
        }
        const canCreate = department.permissions.admin ? userRequirement ? true : false : canCreateNotAdmin;

        if (!canCreate) {
          throw ReturnNormalFailure('BAD_REQUEST', 'You cannot claim this role');
        }

        await readminCollections.session.updateOne({
          _id: session._id
        }, {
          $unset: {
            [`servers.${serverId}.claims.${input.oldUserId}`]: ''
          },
        })
        await readminCollections.session.updateOne({
          _id: session._id
        }, {
          $set: {
            [`servers.${serverId}.claims.${userId}`]: {
              claimId: v4(),
              claimedRole: subrole.id,
              claimedBy: user.dbUser.robloxId,
              claimedAt: new Date(),
              state: 'none'
            }
          }
        })
      }
      await updateAllServerClaimsForSession(session);

      const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: workspace.groupId,
        event: { $in: ['all', 'session-role-claimed'] }
      }).toArray();

      for (const loggingMechanism of foundLoggingMechanisms) {
        const url = loggingMechanism.webhookUrl;
        const userInfo = await getUserInfo(user?.dbUser?.robloxId?.toString() || '1');
        const claimedUser = await getUserInfo(userId?.toString() || '1');
        const oldClaimedUser = await getUserInfo(input.oldUserId?.toString() || '1');
        const userThumbnail = await getUserThumbnail(user?.dbUser?.robloxId?.toString() || '1');
        const desc = `User: ${userInfo?.name}
      \nClaimed Role: ${template.name} for ${claimedUser?.name || userId}
      \nSession name: ${session.template.name}
      \nStart Time: ${returnDiscordMessageFormatForDate(session.date, 'long_date/time')}`;
        await sendWebhookMessage(url, 'blue', 'Session Claim Taken', desc, userThumbnail)
      }


      return {};
    }),

  removeUserSessionClaimForServer: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        serverId: z.string(),
        claimId: z.string().optional(),
        userId: z.string()
      }),
    ).mutation(async ({ ctx, input }) => {
      const { workspace, department, user, userRole } = ctx;
      const { groupId, sessionId, serverId, userId, claimId } = input;

      if (!department.permissions.admin && !department.permissions.sessions.manage) {
        throw ReturnNormalFailure('BAD_REQUEST', 'You cannot unclaim this role');
      }

      const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }
      const template = session.template;
      if (!template) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Template not found');
      }

      const server = session.servers[serverId];
      if (!server) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Server not found');
      }

      if (session?.newClaimingSystem) {
        await readminCollections.session.updateOne({
          _id: session._id
        }, {
          $pull: { [`servers.${serverId}.claims`]: { claimId } },
        })
      } else {
        await readminCollections.session.updateOne({
          _id: session._id
        }, {
          $unset: {
            [`servers.${serverId}.claims.${userId}`]: ''
          }
        })
      }
      await updateAllServerClaimsForSession(session);

      // Audit the release so the attendance grid can surface a "Replaced" (R)
      // status. `session` is the pre-removal snapshot, so the claim's role/id
      // are still readable from it.
      await writeClaimReleaseAudit({
        groupId,
        session,
        serverId,
        userId,
        claimId,
        releasedBy: user?.dbUser?.robloxId?.toString() || 'unknown',
        reason: 'manual',
      });

      const foundLoggingMechanisms = await readminCollections.discord_logging.find({
        groupId: workspace.groupId,
        event: { $in: ['all', 'session-role-claimed'] }
      }).toArray();

      for (const loggingMechanism of foundLoggingMechanisms) {
        const url = loggingMechanism.webhookUrl;
        const userInfo = await getUserInfo(user?.dbUser?.robloxId?.toString() || '1');
        const claimedUser = await getUserInfo(userId?.toString() || '1');
        const userThumbnail = await getUserThumbnail(user?.dbUser?.robloxId?.toString() || '1');
        const desc = `${userInfo?.name} unclaimed role for user ${claimedUser?.name || userId} template ${template.name} on ${returnDiscordMessageFormatForDate(session.date, 'long_date/time')}`;
        await sendWebhookMessage(url, 'blue', 'Session Claim Removed', desc, userThumbnail)
      }


      return {};
    }),

  getSessionComments: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
      }),
    ).query(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, sessionId } = input;

      const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }

      return await Promise.all(session.comments.map(async comment => {
        return {
          ...comment,
          authorInfo: await getUserInfo(comment.authorId),
          thumbnail: await getUserThumbnail(comment.authorId),
          attachments: await presignArrayOfPaths(comment.attachments, 60)
        }
      }));
    }),
  postSessionComment: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        comment: z.string(),
        files: z.array(z.tuple([z.string(), z.string()])),
      }),
    ).mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, sessionId, comment, files } = input;

      const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }

      const urls: string[] = [];
      for (const file of files) {
        const [fileName, fileData] = file;
        const id = v4();
        const filePath = `workspaces/${workspace.groupId}/imgs/${user.dbUser.robloxId}/session-${id}-${fileName}`;
        urls.push(filePath);
        await uploadImage(filePath, fileName, fileData);
        const presignedUrl = await presignUrl(filePath, 604800);
        await sendReAdminInternalWebhookMessage('imageUploads', 'blue', 'Image upload - Session Comment', `https://cdn.readmin.app/${filePath}`, presignedUrl, undefined, presignedUrl)
      }

      await readminCollections.session.updateOne({ _id: session._id }, {
        $push: {
          comments: {
            id: v4(),
            authorId: user?.dbUser?.robloxId || '0',
            note: comment,
            deleteable: true,
            attachments: urls,
            created: new Date()
          }
        }
      })

      return {};
    }),
  deleteSessionComment: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string(),
        serverId: z.string(),
        postId: z.string()
      }),
    ).mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, sessionId, postId } = input;

      const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }

      await readminCollections.session.updateOne({ _id: session._id }, {
        $pull: {
          comments: { id: postId }
        }
      })

      return {};
    }),
  deleteSession: workspacePremiumProcedure
    .input(
      z.object({
        groupId: z.string(),
        sessionId: z.string()
      }),
    ).mutation(async ({ ctx, input }) => {
      const { workspace, department, user } = ctx;
      const { groupId, sessionId } = input;

      if (!department.permissions.sessions.manage) {
        throw ReturnNormalFailure('UNAUTHORIZED', 'You do not have permission to manage sessions');
      }

      const session = await readminCollections.session.findOne({ groupId, _id: StringToObjectID(sessionId) });
      if (!session) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Session not found');
      }

      if (session.oneOffSession == false) {
        throw ReturnNormalFailure('BAD_REQUEST', 'You cannot delete a template session');
      }

      await readminCollections.session.deleteOne({ _id: session._id });

      return {};
    }),
  createOneOffSession: workspacePremiumProcedure.input(
    z.object({
      groupId: z.string(),
      name: z.string(),
      description: z.string(),
      game: z.string(),
      appearsMinutesBefore: z.string(),
      sessionDuration: z.string(),
      rolesEnabled: z.string().array(),
      createDiscordEvent: z.boolean(),
      date: z.date(),
    }),
  )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace, user } = ctx;
      const {
        name,
        description,
        game,
        appearsMinutesBefore,
        sessionDuration,
        rolesEnabled,
        createDiscordEvent,
        groupId,
        date
      } = input;
      if (!(department.permissions.sessions.manage || department.permissions.sessions.createOneTime)) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You do not have permission to manage sessions',
        );
      }
      if (
        !name ||
        !game ||
        !appearsMinutesBefore ||
        !rolesEnabled || !date
      ) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Missing required fields');
      }
      if (
        !date
      ) {
        throw ReturnNormalFailure('BAD_REQUEST', 'Invalid time');
      }
      const foundGames = await readminCollections.game.findOne({
        gameId: parseInt(game),
        groupId: workspace.groupId,
      })
      if (!foundGames) {
        throw ReturnNormalFailure(
          'BAD_REQUEST',
          'Invalid game ID, or game is not tracked by ReAdmin',
        );
      }
      const roles: SessionRoles[] = [];
      for (const role of rolesEnabled) {
        const foundRole = await readminCollections.session_roles.findOne({
          groupId: workspace.groupId,
          id: role,
        });
        if (!foundRole) {
          throw ReturnNormalFailure(
            'BAD_REQUEST',
            'Invalid role ID, or role was deleted.',
          );
        }
        roles.push(foundRole);
      }
      const id = v4();

      // Okay create the template
      await readminCollections.session.insertOne({
        groupId,
        id,
        templateId: null,
        comments: [],
        servers: {},
        claims: [],
        attendees: [],
        date,
        endsAt: addMinutesToDate(date, parseInt(sessionDuration.toString() || '1') == 0 ? 60 : parseInt(sessionDuration.toString() || '1')),
        notifyTime: new Date(new Date(date).getTime() - parseInt(appearsMinutesBefore?.toString() || '1') * 60 * 1000),
        created: new Date(),
        createdBy: user.dbUser.robloxId,
        oneOffSession: true,
        sentDMS: false,
        sentStartMessage: false,
        sentEndMessage: false,
        newClaimingSystem: true,
        template: {
          id,
          name,
          description,
          groupId: workspace.groupId,
          roles: rolesEnabled,
          schedule: { type: 'none', hour: 0, minute: 0 },
          appearsMinutesBefore: parseInt(appearsMinutesBefore),
          sessionDuration: parseInt(sessionDuration),
          placeId: foundGames.placeId,
          gameId: foundGames.gameId,
          createDiscordEvent,
          created: new Date(),
        }
      })

      return { success: true };
    }),

});
