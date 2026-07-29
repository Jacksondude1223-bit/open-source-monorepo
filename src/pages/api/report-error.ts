import type { NextApiRequest, NextApiResponse } from 'next';
import { sendReAdminInternalWebhookMessage } from '~/services/discord.service';
import { env } from '~/services/env';

// In-memory throttling state. This lives for the lifetime of the server
// instance, which is enough to stop a single broken page from flooding the
// channel. Keyed by a hash of the error signature.
const lastSentBySignature = new Map<string, number>();

// Don't re-report the same error signature more than once per window.
const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
// Hard global cap so a storm of *distinct* errors can't spam the channel.
const GLOBAL_WINDOW_MS = 60 * 1000; // 1 minute
const GLOBAL_MAX_PER_WINDOW = 5;

let globalWindowStart = 0;
let globalWindowCount = 0;

function signatureKey(message: string, source: string): string {
  // Cheap, stable hash so identical errors collapse to one key.
  const raw = `${source}::${message}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false });
  }

  const body = (req.body || {}) as {
    message?: unknown;
    stack?: unknown;
    componentStack?: unknown;
    statusCode?: unknown;
    url?: unknown;
  };

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ success: false });
  }

  const stack = typeof body.stack === 'string' ? body.stack : '';
  const componentStack = typeof body.componentStack === 'string' ? body.componentStack : '';
  const url = typeof body.url === 'string' ? body.url : 'unknown';
  const statusCode = typeof body.statusCode === 'number' ? body.statusCode : 500;

  const now = Date.now();
  const key = signatureKey(message, url);

  // Per-signature dedupe.
  const last = lastSentBySignature.get(key);
  if (last && now - last < DEDUPE_WINDOW_MS) {
    return res.status(202).json({ success: true, deduped: true });
  }

  // Global rate limit across all signatures.
  if (now - globalWindowStart > GLOBAL_WINDOW_MS) {
    globalWindowStart = now;
    globalWindowCount = 0;
  }
  if (globalWindowCount >= GLOBAL_MAX_PER_WINDOW) {
    return res.status(429).json({ success: false, throttled: true });
  }

  lastSentBySignature.set(key, now);
  globalWindowCount += 1;

  // Opportunistically prune old entries so the map can't grow unbounded.
  if (lastSentBySignature.size > 500) {
    for (const [mapKey, ts] of lastSentBySignature) {
      if (now - ts > DEDUPE_WINDOW_MS) lastSentBySignature.delete(mapKey);
    }
  }

  const environment = env.NODE_ENV ?? 'unknown';
  const commit = env.COMMIT_HASH ? env.COMMIT_HASH.slice(0, 7) : 'n/a';

  const description = [
    `**URL:** ${truncate(url, 256)}`,
    `**Environment:** ${environment} · **Commit:** ${commit}`,
    '',
    '```',
    truncate([stack || message, componentStack && `\nComponent stack:${componentStack}`]
      .filter(Boolean)
      .join('\n'), 1800),
    '```',
  ].join('\n');

  try {
    await sendReAdminInternalWebhookMessage(
      'panelErrors',
      'red',
      truncate(`❌ ${statusCode} — ${message}`, 240),
      truncate(description, 4000),
    );
  } catch (error) {
    console.error('Failed to forward error report to webhook:', error);
    return res.status(502).json({ success: false });
  }

  return res.status(200).json({ success: true });
}
