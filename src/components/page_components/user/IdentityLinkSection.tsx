import { useState } from 'react';
import ReactTimeago from 'react-timeago';
import toast from 'react-hot-toast';
import {
  LinkIcon,
  DocumentDuplicateIcon,
  CheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useUser } from '~/components/contexts/user';
import { trpc } from '~/utils/trpc';
import Button from '~/components/forms/Button';

/**
 * Founder-only identity link panel. Mints a short code the founder redeems
 * in-game with `/verify <code>`, linking that game's (possibly domain-scoped)
 * view of them to their panel identity. Gated to site-role Founder while the
 * flow is dogfooded — see identityLink router. Renders nothing for everyone
 * else, so it's invisible to regular users.
 */
export default function IdentityLinkSection() {
  const info = useUser();
  const isFounder = 'user' in info && info.user?.dbUser.role === 'Founder';
  const status = trpc.identityLink.status.useQuery(undefined, {
    // Only founders can call it; skip for everyone else to avoid an UNAUTHORIZED.
    enabled: isFounder,
    retry: false,
  });
  const generateCode = trpc.identityLink.generateCode.useMutation();

  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isFounder) {
    return null;
  }

  const handleGenerate = async () => {
    try {
      const result = await generateCode.mutateAsync();
      setCode(result.code);
      setExpiresAt(new Date(result.expiresAt));
      setCopied(false);
    } catch (e) {
      toast.error('Could not generate a link code. Please try again.');
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const verified = status.data?.verified;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LinkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Identity Link</h2>
          </div>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Founder testing
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Generate a code, then run <span className="font-mono">/verify &lt;code&gt;</span> in any of
          your games to link that game&apos;s activity to your ReAdmin identity. Codes are single-use
          and expire after 15 minutes.
        </p>

        {/* Current verification status */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Status:</span>
          {status.isLoading ? (
            <span className="text-gray-400">Checking…</span>
          ) : verified ? (
            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
              <CheckIcon className="h-4 w-4" /> Verified history
              {typeof status.data?.linkedKeys === 'number' && status.data.linkedKeys > 1
                ? ` · ${status.data.linkedKeys} linked identities`
                : ''}
            </span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">Not linked beyond a single game</span>
          )}
        </div>

        {/* Code display */}
        {code && (
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-700">
            <p className="text-2xl font-mono tracking-[0.3em] break-all flex-1 text-gray-900 dark:text-white">
              {code}
            </p>
            <Button
              type="button"
              icon={copied ? CheckIcon : DocumentDuplicateIcon}
              className="h-min shrink-0"
              variant="discrete"
              onClick={handleCopy}
            />
          </div>
        )}

        {code && expiresAt && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Expires <ReactTimeago date={expiresAt} />.
          </p>
        )}

        <div>
          <Button
            type="button"
            variant="primary"
            icon={ArrowPathIcon}
            disabled={generateCode.isPending}
            onClick={handleGenerate}
          >
            {generateCode.isPending ? 'Generating…' : code ? 'Generate new code' : 'Generate link code'}
          </Button>
        </div>
      </div>
    </div>
  );
}
