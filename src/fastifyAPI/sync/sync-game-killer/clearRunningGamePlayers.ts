import { readminCollections } from "~/services/mongo.service";

export default async function ClearBadRunningGames() {
    const runningServers = await readminCollections.running_games.find({});

    const runningGameIds = await runningServers.map(a => a._id).toArray();

    await readminCollections.running_game_players.deleteMany({
        runningGameId: { $nin: runningGameIds },
    });
}