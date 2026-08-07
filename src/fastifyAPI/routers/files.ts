import { FastifyInstance, FastifyReply } from 'fastify';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import {
  readObjectMeta,
  resolveObjectFile,
  verifySignature,
} from '~/services/storage/local.driver';
import { usingLocalStorage } from '~/services/storage';

/**
 * Serves objects held on this server's disk (STORAGE_DRIVER=local). With the S3
 * driver these routes are not registered at all — the bucket serves its own
 * bytes and nothing should reach here.
 *
 * Two ways in, mirroring the two ACLs:
 *
 *   GET /files/signed/<key>?expires=&signature=   private objects, time-limited
 *   GET /files/public/<key>                       objects stored `public-read`
 *
 * The signature is an HMAC over key + expiry (see local.driver.ts). Without a
 * valid one a private object is unreachable, which is the whole point: keys are
 * predictable, so the signature is what actually guards the file.
 */
// A plain plugin, not a fastify-plugin one: fastify-plugin would break
// encapsulation and the `/files` prefix would be silently ignored.
export const filesRouter = async (fastify: FastifyInstance) => {
  if (!usingLocalStorage) {
    return;
  }

  /** Stream an object, or answer 404. Never reveals why a request failed. */
  async function send(reply: FastifyReply, key: string) {
    const file = await resolveObjectFile(key).catch(() => null);
    if (!file) {
      return reply.status(404).send({ success: false, message: 'Not found' });
    }
    const meta = await readObjectMeta(key);
    const { size } = await stat(file);
    return reply
      .header('Content-Type', meta?.contentType || 'application/octet-stream')
      .header('Content-Length', size)
      .send(createReadStream(file));
  }

  fastify.get<{ Params: { '*': string }; Querystring: { expires?: string; signature?: string } }>(
    '/signed/*',
    async (request, reply) => {
      const key = decodeURIComponent(request.params['*'] || '');
      const expires = Number(request.query.expires);
      if (!verifySignature(key, expires, request.query.signature || '')) {
        // 403 rather than 404: the link was real, it has simply run out.
        return reply.status(403).send({ success: false, message: 'Link expired or invalid' });
      }
      return send(reply, key);
    },
  );

  fastify.get<{ Params: { '*': string } }>('/public/*', async (request, reply) => {
    const key = decodeURIComponent(request.params['*'] || '');
    const meta = await readObjectMeta(key);
    // Only objects deliberately uploaded public-read are served without a
    // signature. Anything else is a 404 here — it has a signed URL instead.
    if (meta?.acl !== 'public-read') {
      return reply.status(404).send({ success: false, message: 'Not found' });
    }
    return send(reply, key);
  });
};
