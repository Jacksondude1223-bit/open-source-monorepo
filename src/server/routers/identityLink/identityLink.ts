import { founderProcedure } from '~/server/procedures';
import { router } from '~/server/trpc';
import { issueLinkCode } from '~/services/userLinkCode.service';
import { getIdentityVerification } from '~/services/userIdentity.service';

/**
 * Identity linking from the panel side. The logged-in user mints a short-lived
 * code, then redeems it in any of their games with `/verify <code>` — merging
 * that game's (possibly domain-scoped) view of them onto their panel identity.
 * This is the transport-independent floor; the Roblox User Account Linking API
 * (Aug 2026) will plug in as a second source behind the same merge.
 *
 * Gated to site-role Founder for now: the flow is being dogfooded before general
 * release, and we don't want regular users discovering it. Loosen to
 * authenticatedProcedure when it ships.
 */
export const identityLinkRouter = router({
    // Mint a fresh link code for the logged-in user. Replaces any prior unused code.
    generateCode: founderProcedure.mutation(async ({ ctx }) => {
        const robloxId = ctx.user.dbUser.robloxId.toString();
        const { code, expiresAt } = await issueLinkCode(robloxId, { username: ctx.user.dbUser.name });
        return { code, expiresAt };
    }),

    // Whether the logged-in user's identity is linked beyond a single game —
    // powers the "verified history" indicator.
    status: founderProcedure.query(async ({ ctx }) => {
        const robloxId = ctx.user.dbUser.robloxId.toString();
        return getIdentityVerification(robloxId);
    }),
});
