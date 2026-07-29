import { APIUser } from 'discord-api-types/v10';
import { UserInfo } from './roblox.types';
import { User } from '~/services/NewMongoTypes';

export type JWTUser = {
  secureToken: string;
  discord: APIUser;
  dbUser: User;
  thumbnail?: string;
  roblox?: UserInfo;
};
