import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import type { Env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';

// Keys are separate from JWT signing and from each other. v1 supports explicit future rotation.
export class GuestCrypto {
  constructor(private readonly env: Pick<Env, 'GUEST_ENCRYPTION_KEY' | 'GUEST_HASH_KEY'>) {}
  private key(value: string | undefined) {
    if (!value)
      throw new AppError(
        503,
        'GUEST_CRYPTO_UNAVAILABLE',
        'Guest document protection is unavailable',
      );
    return Buffer.from(value, 'hex');
  }
  encrypt(hotelId: bigint, value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(this.env.GUEST_ENCRYPTION_KEY), iv);
    cipher.setAAD(Buffer.from(`guest-document:v1:${hotelId}`));
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }
  decrypt(hotelId: bigint, value: string) {
    const key = this.key(this.env.GUEST_ENCRYPTION_KEY);
    try {
      const [version, iv, tag, ciphertext, extra] = value.split('.');
      if (version !== 'v1' || !iv || !tag || !ciphertext || extra !== undefined) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
      decipher.setAAD(Buffer.from(`guest-document:v1:${hotelId}`));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new AppError(500, 'GUEST_DATA_UNAVAILABLE', 'Guest document could not be read');
    }
  }
  fingerprint(hotelId: bigint, value: string) {
    const normalized = value
      .normalize('NFKC')
      .toUpperCase()
      .replace(/[\s./-]/gu, '');
    return createHmac('sha256', this.key(this.env.GUEST_HASH_KEY))
      .update(`guest-document:v1:${hotelId}:${normalized}`)
      .digest('hex');
  }
}
