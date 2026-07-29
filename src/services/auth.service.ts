import { sign, verify } from 'jsonwebtoken';
import { updateStripeUser } from './stripe.service';
import { encrypt, generateSecureString } from './Crypto-service.service';
import { env } from '~/services/env';
import { getUserInfo, getUserThumbnail } from './roblox.service';
import { JWTUser } from '~/services/types/JWT.type';
import { RobloxOpenCloudUserInformation, RobloxOAuthAuthorizationExchangeResponse } from '~/services/types/roblox.opencloud.types';
import { readminCollections } from '~/services/mongo.service';
import { User } from './NewMongoTypes';
import { ensureUserIdentity } from './userIdentity.service';

export async function createSessionForRobloxUser(
  user: RobloxOpenCloudUserInformation,
  oauthInfo: RobloxOAuthAuthorizationExchangeResponse,
): Promise<[string, User]> {
  // Generate a secure token which is mathematically random to ensure the JWT can't be faked easily.
  const secureToken = await generateSecureString();

  let dbUser = await readminCollections.user.findOne({
    robloxId: user.sub.toString(),
  }) as User;


  if (!dbUser) {
    const inserted = await readminCollections.user.insertOne({
      robloxId: user.sub.toString(),
      role: 'User',
      isModerated: false,
      created: new Date()
    })
    dbUser = await readminCollections.user.findOne({ _id: inserted.insertedId }) as User;
  }

  await readminCollections.user.updateOne({
    _id: dbUser._id,
  }, {
    $set: {
      thumbnail: user.picture,
      preferred_username: user.preferred_username,
      name: user.name,
      nickname: user.nickname,
      accessToken: encrypt(oauthInfo.access_token),
      refreshToken: encrypt(oauthInfo.refresh_token),
      accessTokenUpdatedAt: new Date(),
      lastLogin: new Date(),
    }
  })

  const realUser = await readminCollections.user.findOne({ robloxId: user.sub.toString() }) as User;
  if (realUser) {
    await updateStripeUser(realUser);
  }

  // Anchor the hub identity. The OAuth `sub` is the user's stable key in the
  // ReAdmin (OAuth) domain — the backbone that every game-scoped key links onto.
  // Capturing it at login means the link target exists before any /verify, and
  // keeps names fresh from a source that works even for scoped users.
  await ensureUserIdentity(user.sub.toString(), {
    username: user.preferred_username || user.name,
    displayName: user.name,
  }).catch((e) => {
    console.error('ensureUserIdentity failed at login', user.sub, e);
  });

  // Create JWT
  const token = sign(
    {
      secureToken,
      robloxId: dbUser.robloxId,
      name: dbUser.name,
      role: dbUser.role,
    },
    env.JSON_WEB_TOKEN_SECRET,
    { expiresIn: '7d' },
  );

  await readminCollections.user_auth_session.insertOne({
    _id: secureToken,
    robloxId: user.sub.toString(),
    created: new Date()
  })


  // Return new JWT
  return [token, realUser];
}

export async function createSessionFromDBUser(dbUser: User): Promise<[string, User]> {
  // Generate a secure token which is mathematically random to ensure the JWT can't be faked easily.
  const secureToken = await generateSecureString();

  // Create JWT
  const token = sign(
    {
      secureToken,
      robloxId: dbUser.robloxId,
      name: dbUser.name,
      role: dbUser.role,
    },
    env.JSON_WEB_TOKEN_SECRET,
    { expiresIn: '7d' },
  );

  await readminCollections.user_auth_session.insertOne({
    _id: secureToken,
    robloxId: dbUser.robloxId.toString(),
    created: new Date()
  })


  // Return new JWT
  return [token, dbUser];
}

export async function checkJWT(auth: string): Promise<JWTUser | null> {
  let user = null;

  await verify(
    auth,
    env.JSON_WEB_TOKEN_SECRET,
    async (err, verifiedUser: any): Promise<void> => {
      if (err) {
        return;
      }
      const session = await readminCollections.user_auth_session.findOne({ _id: verifiedUser.secureToken });
      if (!session) {
        return;
      }

      const robloxId: string = verifiedUser.robloxId;

      if (verifiedUser.robloxId !== robloxId) {
        return; // token mismatch, highly suspicous. probably should call FBI.
      }

      // Find the database user
      const dbUser = await readminCollections.user.findOne({
        robloxId: robloxId.toString(),

      });
      if (!dbUser) {
        return;
      }

      if (dbUser.robloxId) {
        const [info, thumbnail] = await Promise.all([
          getUserInfo(dbUser.robloxId),
          getUserThumbnail(dbUser.robloxId),
        ]);
        verifiedUser.roblox = info;
        verifiedUser.thumbnail = thumbnail;
      }

      user = { ...verifiedUser, dbUser };
    },
  );
  return user;
}