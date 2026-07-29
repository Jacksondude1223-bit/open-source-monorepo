export type RobloxOAuthAuthorizationExchangeResponse = {
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
    expires_in: number;
    id_token: string;
    scope: string;
}
export type RobloxOAuthAuthorizationRefreshResponse = {
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope: string;
}

export type RobloxOpenCloudUserInformation = {
    sub: string;
    name: string;
    nickname: string;
    preferred_username: string;
    created_at: number;
    profile: string;
    picture: string;
}
export interface RobloxOpenCloudUniverseType {
    path: string;
    createTime: string;
    updateTime: string;
    displayName: string;
    description: string;
    user?: string;
    group?: string;
    visibility: 'PUBLIC' | 'PRIVATE';
    facebookSocialLink: RobloxOpenCloudUniverseTypeSocialLink;
    twitterSocialLink: RobloxOpenCloudUniverseTypeSocialLink;
    youtubeSocialLink: RobloxOpenCloudUniverseTypeSocialLink;
    twitchSocialLink: RobloxOpenCloudUniverseTypeSocialLink;
    discordSocialLink: RobloxOpenCloudUniverseTypeSocialLink;
    robloxGroupSocialLink: RobloxOpenCloudUniverseTypeSocialLink;
    guildedSocialLink: RobloxOpenCloudUniverseTypeSocialLink;
    voiceChatEnabled: boolean;
    ageRating: string;
    privateServerPriceRobux: string;
    desktopEnabled: boolean;
    mobileEnabled: boolean;
    tabletEnabled: boolean;
    consoleEnabled: boolean;
    vrEnabled: boolean;
}
export interface RobloxOpenCloudUniverseTypeSocialLink {
    title: string;
    uri: string;
}

export interface RobloxOpenCloudPlaceType {
    path: string;
    createTime: string;
    updateTime: string;
    displayName: string;
    description: string;
    serverSize: number;
}


export interface RobloxOpenCloudUserType {
  path: string;
  createTime: string;
  id: string;
  name: string;
  displayName: string;
  about: string;
  locale?: "en-US",
  premium: boolean;
  idVerified: boolean;
  socialNetworkProfiles?: {
    facebook?: string;
    twitter?: string;
    youtube?: string;
    twitch?: string;
    guilded?: string;
    visibility?: "SOCIAL_NETWORK_VISIBILITY_UNSPECIFIED"
  }
}

export interface RobloxOpenCloudThumbnailResponse {
  path: string;
  metadata?: {
    '@type': string;
    [key: string]: unknown;
  };
  done: boolean;
  error?: {
    code: number;
    message: string;
    details?: Array<{ '@type': string; [key: string]: unknown }>;
  };
  response?: {
    '@type': string;
    imageUri: string;
    [key: string]: unknown;
  };
}


export type RobloxOpenCloudGroupRoleResponse = {
    groupRoles: {
            path: `groups/${number}/roles/${number}`,
            createTime: string;
            updateTime: string;
            id: string;
            displayName: string;
            description: string;
            rank: number;
            memberCount: number;
            permissions: {
                viewWallPosts: boolean;
                createWallPosts: boolean;
                deleteWallPosts: boolean;
                viewGroupShout: boolean;
                createGroupShout: boolean;
                changeRank: boolean;
                acceptRequests: boolean;
                exileMembers: boolean;
                manageRelationships: boolean;
                viewAuditLog: boolean;
                spendGroupFunds: boolean;
                advertiseGroup: boolean;
                createAvatarItems: boolean;
                manageAvatarItems: boolean;
                manageGroupUniverses: boolean;
                viewUniverseAnalytics: boolean;
                createApiKeys: boolean;
                manageApiKeys: boolean;
                banMembers: boolean;
                viewForums: boolean;
                manageCategories: boolean;
                createPosts: boolean;
                lockPosts: boolean;
                pinPosts: boolean;
                removePosts: boolean;
                createComments: boolean;
                removeComments: boolean;
                manageBlockedWords: boolean;
                viewBlockedWords: boolean;
                bypassSlowMode: boolean;
            }
        }[],
    nextPageToken?: string;
}

export type RobloxOpenCloudGroupMemberResponse = {
    groupMemberships: {
            path: `groups/${number}/memberships/${string}`,
            createTime: string,
            updateTime: string,
            user: `users/${number}`,
            role: `groups/${number}/roles/${number}`,
            roles: [
                `groups/${number}/roles/${number}`
            ]
    }[],
    nextPageToken?: string;
}