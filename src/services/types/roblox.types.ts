export type OAuthUserInformation = {
  sub: string;
  name: string;
  nickname: string;
  preferred_username: string;
  created_at: number;
  profile: string;
  picture: string;
}

export type UserGroupsResponse = {
  data?: UserGroupResponseData[];
};

export type UserMembershipsOC = {
    "groupMemberships":  {
            "path": `groups/${groupId}/memberships/${userId}`,
            "createTime": string;
            "updateTime": string;
            "user": `users/${userId}`,
            "role": `groups/${groupId}/roles/${roleId}`,
            "roles": 
                `groups/${groupId}/roles/${roleId}`[]
        }[],
    "nextPageToken": string;
}

export type UserGroupResponseData = {
  group: Group;
  role: UserRole;
};

export type Group = {
  id: number;
  name: string;
  memberCount: number;
  hasVerifiedBadge: boolean;
  thumbnail?: string;
};

export type UserRole = {
  id: number;
  name: string;
  rank: number;
};

export type ThumbnailResponse = {
  data: ThumbnailJson[];
};

export type ThumbnailJson = {
  targetId: number;
  state: string;
  imageUrl: string;
};

export type GroupInfoResponse = {
  id: number;
  name: string;
  description: string;
  owner: Owner;
  shout: Shout;
  memberCount: number;
  isBuildersClubOnly: boolean;
  publicEntryAllowed: boolean;
  hasVerifiedBadge: boolean;
  thumbnail: string;
};
export type groupId = string | number;
export type roleId = string | number;
export type userId = string | number;

export type GroupInfoResponseOC = {
    "path": `groups/${groupId}`,
    "createTime": string,
    "updateTime": string,
    "id": string,
    "displayName": string,
    "description": string,
    "owner": `users/${userId}`,
    "memberCount": number,
    "publicEntryAllowed": boolean,
    "locked": boolean,
    "verified": boolean
}

export type Owner = {
  hasVerifiedBadge: boolean;
  userId: number;
  username: string;
  displayName: string;
};

export type Shout = {
  body: string;
  poster: Owner;
  created: Date;
  updated: Date;
};

export type GroupRolesResponse = {
  groupId: number;
  roles: GroupRole[];
};

export type GroupRolesResponseOC = {
    "groupRoles": {
            "path": `groups/${groupId}/roles/${roleId}`,
            "createTime": string;
            "updateTime": string;
            "id": groupId;
            "displayName": string;
            "description": string;
            "rank": number;
            "memberCount": number;
            "permissions": {
                "viewWallPosts": boolean,
                "createWallPosts": boolean,
                "deleteWallPosts": boolean,
                "viewGroupShout": boolean,
                "createGroupShout": boolean,
                "changeRank": boolean,
                "acceptRequests": boolean,
                "exileMembers": boolean,
                "manageRelationships": boolean,
                "viewAuditLog": boolean,
                "spendGroupFunds": boolean,
                "advertiseGroup": boolean,
                "createAvatarItems": boolean,
                "manageAvatarItems": boolean,
                "manageGroupUniverses": boolean,
                "viewUniverseAnalytics": boolean,
                "createApiKeys": boolean,
                "manageApiKeys": boolean,
                "banMembers": boolean,
                "viewForums": boolean,
                "manageCategories": boolean,
                "createPosts": boolean,
                "lockPosts": boolean,
                "pinPosts": boolean,
                "removePosts": boolean,
                "createComments": boolean,
                "removeComments": boolean,
                "manageBlockedWords": boolean,
                "viewBlockedWords": boolean,
                "bypassSlowMode": boolean
            }
        }[]
    "nextPageToken": string;
}

export type GroupRole = {
  id: number;
  name: string;
  rank: number;
  memberCount: number;
};

export type UserInfo = {
  description: string;
  created: Date;
  isBanned: boolean;
  externalAppDisplayName: string|null;
  hasVerifiedBadge: boolean;
  id: number;
  name: string;
  displayName: string;
};

export type RobloxUsernameSearchResponse = {
  data: UsernameSearchResponse[];
};

export type UsernameSearchResponse = {
  requestedUsername: string;
  hasVerifiedBadge: boolean;
  id: number;
  name: string;
  displayName: string;
};

export type RobloxUserSearch = {
  previousPageCursor: null;
  nextPageCursor: string;
  data: SearchUser[];
};

export type SearchUser = {
  previousUsernames: any[];
  hasVerifiedBadge: boolean;
  id: number;
  name: string;
  displayName: string;
};

export type RobloxGameInfoResponse = {
  data: GameResponse[];
};

export type GameResponse = {
  id: number;
  rootPlaceId: number;
  name: string;
  description: null;
  sourceName: string;
  sourceDescription: string;
  creator: Creator;
  price: null;
  allowedGearGenres: string[];
  allowedGearCategories: any[];
  isGenreEnforced: boolean;
  copyingAllowed: boolean;
  playing: number;
  visits: number;
  maxPlayers: number;
  created: Date;
  updated: Date;
  studioAccessToApisAllowed: boolean;
  createVipServersAllowed: boolean;
  universeAvatarType: string;
  genre: string;
  isAllGenre: boolean;
  isFavoritedByUser: boolean;
  favoritedCount: number;
};

export type universeId = string | number;
export type placeId = string | number;

export type UniverseInfoOC = {
    "path": `universes/${universeId}`,
    "createTime": string;
    "updateTime": string;
    "displayName": string;
    "description": string;
    "group"?: `groups/${groupId}`,
    "user"?: `users/${userId}`,
    "visibility": "PUBLIC"|'RESTRICTED'|'PRIVATE';
    "youtubeSocialLink"?: {
        "title": string;
        "uri": string;
    },
    "discordSocialLink"?: {
        "title": string;
        "uri": string;
    },
    "robloxGroupSocialLink"?: {
        "title": string,
        "uri": string
    },
    "voiceChatEnabled": boolean;
    "ageRating": "AGE_RATING_UNSPECIFIED"|string,
    "desktopEnabled": boolean,
    "mobileEnabled": boolean,
    "tabletEnabled": boolean,
    "consoleEnabled": boolean,
    "vrEnabled": boolean,
    "rootPlace": `universes/${universeId}/places/${placeId}`,
    "templateRootPlace": string;
}

export type Creator = {
  id: number;
  name: string;
  type: string;
  isRNVAccount: boolean;
  hasVerifiedBadge: boolean;
};

export type RobloxGroupRoleUsersResponse = {
  previousPageCursor: null;
  nextPageCursor: string;
  data: RobloxGroupRoleUser[];
};

export type RobloxGroupRoleUser = {
  hasVerifiedBadge: boolean;
  userId: number;
  username: string;
  displayName: string;
};


export type UsersAuthenticatedMinimalResponse = {
  id: number;
  name: string;
  displayName: string;
}

export type RobloxPlaceInfoResponse = {
  [key: string]: PlaceData;
};

export type PlaceData = {
  placeId: number;
  name: string;
  description: string;
  sourceName: string;
  sourceDescription: string;
  url: string;
  builder: string;
  builderId: number;
  hasVerifiedBadge: boolean;
  isPlayable: boolean;
  reasonProhibited: string;
  universeId: number;
  universeRootPlaceId: number;
  price: number;
  imageToken: string;
}
