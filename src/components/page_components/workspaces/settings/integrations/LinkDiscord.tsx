import Button from '~/components/forms/Button';
import { getBaseUrl } from '~/utils/trpc';

export default function LinkDiscord({ groupId }: { groupId: string }) {
  const url = getBaseUrl();
  const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(
    process.env?.NEXT_PUBLIC_DISCORD_CLIENT_ID||'',
  )}&permissions=8&redirect_uri=${encodeURIComponent(
    `${url}/workspaces/discord/link`,
  )}&response_type=code&scope=identify%20bot%20applications.commands&state=${encodeURIComponent(
    groupId,
  )}`;

  return (
    <div>
      <p className="font-bold text-lg">Link your Discord Guild</p>
      <p>
        Linking your Discord guild with ReAdmin unlocks automations when using
        our premium plans.
      </p>
      <Button
        href={oauthUrl}
        className="w-44 mt-2"
        variant="primary"
        target="__blank"
        size="medium"
      >
        Link Discord Guild
      </Button>
    </div>
  );
}
