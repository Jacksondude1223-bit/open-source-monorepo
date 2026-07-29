
import { ObjectId } from 'mongodb';
import type { PlaceData } from '~/services/types/roblox.types';

export type Game = {
  _id?: ObjectId;
  groupId: string;
  gameId: number; // Universe ID
  placeId: number; // Sub universe
  viewable: boolean;
  name: string;
  images: {
    icon: string;
    thumbnail: string;
  };
  lastSeen: Date;
  lastUpdated?: Date;
  placeInfo?: PlaceData;
  created: Date;
  // When true, the game is hidden from dashboard/game listings without
  // deleting any of its tracking data. Set via the "delete game" action.
  hideFromDashboard?: boolean;
}
