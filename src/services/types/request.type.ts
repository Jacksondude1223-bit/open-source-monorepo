import { Department, Game, RunningGames, Workspace } from '~/services/NewMongoTypes';
import { JWTUser } from './JWT.type';
import { GroupInfoResponse, GroupInfoResponseOC } from '~/services/types/roblox.types';

interface GroupInfoResponseWithThumbnail extends GroupInfoResponseOC {
  thumbnail: string;
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-expect-error
export interface ModifiedContext extends Context {
  user?: JWTUser;
  workspace?: Workspace;
  group?: GroupInfoResponseWithThumbnail | null;
  department?: Department;
}
export interface ModifiedContextWorkspace {
  user: JWTUser;
  workspace: Workspace;
  group: GroupInfoResponseWithThumbnail;
  department: Department;
}

export interface ModifiedContextUser {
  user: JWTUser;
}

export interface ModifiedContextWorkspaceGame extends ModifiedContextWorkspace {
  game: Game;
}
export interface ModifiedContextWorkspaceServer
  extends ModifiedContextWorkspaceGame {
  running: RunningGames;
}
