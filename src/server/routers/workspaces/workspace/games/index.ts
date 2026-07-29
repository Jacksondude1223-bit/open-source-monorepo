import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { router } from '~/server/trpc';
import { workspaceGamesBansRouter } from './bans';
import { workspaceGamesGameRouter } from './game';
import { getRobloxGameInfo, getRobloxGameIcon, getRobloxGameThumbnail, getGroupInfo, getUserInfo } from '~/services/roblox.service';
import { readminCollections } from '~/services/mongo.service';
import { Game } from '~/services/NewMongoTypes';
import { getPlaceInfo, getUniverseInfo } from '~/services/opencloud.roblox.service';

async function updateGame(game: Game) {
  try {
    if (game.lastUpdated) {
      if (game.lastUpdated >= new Date(Date.now() - 1000 * 60 * 60 * 24)) {
        return;
      }
    }

    const [info, icon, thumbnail, unvierseInfo, placeInfo] = await Promise.all([
      getRobloxGameInfo(game.gameId.toString()),
      getRobloxGameIcon(game.gameId.toString()),
      getRobloxGameThumbnail(game.gameId.toString()),
      getUniverseInfo(game.gameId.toString()),
      getPlaceInfo(game.gameId.toString(), game.placeId.toString()),
    ]);

    if (!placeInfo || !unvierseInfo) {
      return;
    }
    const owner = 'group' in unvierseInfo ? unvierseInfo.group as string : unvierseInfo.user as string;
    const ownerType = 'group' in unvierseInfo ? 'group' : 'user';
    //@ts-expect-error close enough
    const ownerName = ownerType === 'group' ? (await getGroupInfo(owner.split('groups/')[1]))?.name : (await getUserInfo(owner.split('users/')[1]))?.name;


    await readminCollections.game.updateOne({
      _id: game._id
    }, {
      $set: {
        name: info.displayName,
        icon,
        thumbnail,
        placeInfo: {
          placeId: game.placeId,
          name: placeInfo.displayName,
          description: placeInfo.description,
          sourceName: unvierseInfo.displayName,
          sourceDescription: unvierseInfo.description,
          url: `https://www.roblox.com/games/${game.gameId}/${game.name.split(' ').join('%20')}`,
          builder: ownerName || '',
          builderId: parseInt(owner) || 1,
          hasVerifiedBadge: false,
          isPlayable: unvierseInfo.visibility == 'PUBLIC',
          reasonProhibited: 'None',
          universeId: game.gameId,
          universeRootPlaceId: game.placeId,
          price: 0,
          imageToken: '',
        },
        lastUpdated: new Date()
      }
    });
  } catch (e) {
    console.error(e);
    return; //really not a big deal
  }
}


export const workspaceGamesRouter = router({
  bans: workspaceGamesBansRouter,
  game: workspaceGamesGameRouter,
  getGames: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, user } = ctx;
      if (!user) return;
      const { } = input;

      const games = await readminCollections.game.find({
        groupId: workspace.groupId,
        hideFromDashboard: { $ne: true },
      }).toArray()

      for (const game of games) {
        try {
          updateGame(game);
        } catch (e) {
          console.error(e);
        }
      }

      return games;
    }),
  // Returns every game for the workspace, including ones hidden from the
  // dashboard. Used to resolve game names for historical data (e.g. a user's
  // past activity sessions for games that have since been removed).
  getAllGames: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspace, user } = ctx;
      if (!user) return;
      const { } = input;

      const games = await readminCollections.game.find({
        groupId: workspace.groupId,
      }).toArray()

      return games;
    }),
});
