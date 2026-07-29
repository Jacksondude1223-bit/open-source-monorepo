import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { workspaceProcedure } from '~/server/procedures';
import { router } from '~/server/trpc';
import { readminCollections } from '~/services/mongo.service';
import { decrypt, encrypt } from '~/services/Crypto-service.service';

/**
 * Whether the viewer is allowed to read members' personal details. Workspace
 * admins always can; otherwise the department must grant `profile.view`. This is
 * a separate gate from `profile.edit` because the details may contain PII.
 */
function canViewProfile(department: { permissions: { admin: boolean; profile?: { view?: boolean } } }): boolean {
  return !!(department.permissions.admin || department.permissions.profile?.view);
}

/** Whether the viewer is allowed to add/edit members' personal details. */
function canEditProfile(department: { permissions: { admin: boolean; profile?: { edit?: boolean } } }): boolean {
  return !!(department.permissions.admin || department.permissions.profile?.edit);
}

// Empty strings clear the stored value; trim to avoid storing whitespace-only.
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v == null ? undefined : v.trim()));

export const workspaceActivityUsersDetailsRouter = router({
  // Returns the workspace-scoped personal details for a member. The sensitive
  // `address` field is decrypted server-side only for viewers who pass the
  // permission check. Birthday is sourced read-only from the member's ReAdmin
  // account and is never editable here.
  get: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { department } = ctx;
      const { groupId, userId } = input;

      if (!canViewProfile(department)) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to view personal details.',
        });
      }

      const [details, account] = await Promise.all([
        readminCollections.group_member_details.findOne({
          groupId,
          userId: parseInt(userId),
        }),
        readminCollections.user.findOne(
          { robloxId: userId },
          { projection: { birthday: 1 } },
        ),
      ]);

      let address: string | undefined = undefined;
      if (details?.address) {
        try {
          address = decrypt(details.address);
        } catch {
          // Stored value could not be decrypted (e.g. key rotation) — surface as
          // empty rather than leaking ciphertext or throwing.
          address = undefined;
        }
      }

      return {
        firstName: details?.firstName ?? null,
        lastName: details?.lastName ?? null,
        email: details?.email ?? null,
        country: details?.country ?? null,
        timezone: details?.timezone ?? null,
        address: address ?? null,
        // Read-only, sourced from the member's ReAdmin account.
        birthday: account?.birthday ?? null,
        updatedBy: details?.updatedBy ?? null,
        updatedAt: details?.updatedAt ?? null,
        canEdit: canEditProfile(department),
      };
    }),

  // Upserts the workspace-scoped personal details for a member. The `address`
  // field is encrypted at rest. Sending an empty string for a field clears it.
  update: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
        firstName: optionalText(100),
        lastName: optionalText(100),
        email: optionalText(254),
        country: optionalText(100),
        timezone: optionalText(100),
        address: optionalText(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, user } = ctx;
      const { groupId, userId } = input;

      if (!canEditProfile(department)) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to edit personal details.',
        });
      }

      if (input.email && !z.string().email().safeParse(input.email).success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Please enter a valid email address.',
        });
      }

      // Partial update: only fields explicitly present in the input are touched,
      // so editing one card never clears the others. A field sent as an empty
      // string is an explicit "clear" ($unset); a field omitted (undefined) is
      // left exactly as-is.
      const set: Record<string, unknown> = {
        updatedBy: user.dbUser.robloxId || null,
        updatedAt: new Date(),
      };
      const unset: Record<string, ''> = {};

      const assign = (key: string, value: string | undefined, encrypted = false) => {
        if (value === undefined) return; // not provided — leave untouched
        if (value) {
          set[key] = encrypted ? encrypt(value) : value;
        } else {
          unset[key] = ''; // explicit clear
        }
      };

      assign('firstName', input.firstName);
      assign('lastName', input.lastName);
      assign('email', input.email);
      assign('country', input.country);
      assign('timezone', input.timezone);
      assign('address', input.address, true);

      await readminCollections.group_member_details.updateOne(
        { groupId, userId: parseInt(userId) },
        {
          $set: set,
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
          $setOnInsert: { groupId, userId: parseInt(userId), created: new Date() },
        },
        { upsert: true },
      );

      return { success: true };
    }),
});
