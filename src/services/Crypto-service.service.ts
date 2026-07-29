import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '~/services/env';

const IV_LENGTH = 16;

export async function generateSecureString(bytes = 64): Promise<string> {
  return randomBytes(bytes).toString('hex');
}

export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(
    'aes-256-cbc',
    Buffer.from(env.CRYPTO_KEY as string),
    iv,
  );
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  const textParts = text.split(':');
  //@ts-expect-error it'll buff
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = createDecipheriv(
    'aes-256-cbc',
    Buffer.from(env.CRYPTO_KEY as string),
    iv,
  );
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}
