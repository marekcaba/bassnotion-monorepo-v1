import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

import { BunnyVideoService } from '../bunny-video.service.js';
import type { ConfigService } from '@nestjs/config';

const KEY = 'test-token-auth-key';
const LIB = '583585';
const VIDEO = '032167b4-aaaa-bbbb-cccc-deadbeef0001';

function makeService(env: Record<string, string | undefined>) {
  const configService = {
    get: (k: string) => env[k],
  } as unknown as ConfigService;
  return new BunnyVideoService(configService);
}

describe('BunnyVideoService.signEmbedUrl', () => {
  it('produces the Bunny token = sha256_hex(key + videoId + expires)', () => {
    const svc = makeService({ BUNNY_TOKEN_AUTH_KEY: KEY, BUNNY_LIBRARY_ID: LIB });
    const now = 1_000_000; // seconds
    const { embedUrl, expires } = svc.signEmbedUrl(VIDEO, LIB, now);

    // ttl is 6h
    expect(expires).toBe(now + 6 * 60 * 60);

    const expectedToken = createHash('sha256')
      .update(KEY + VIDEO + expires)
      .digest('hex');

    const url = new URL(embedUrl);
    expect(url.origin + url.pathname).toBe(
      `https://iframe.mediadelivery.net/embed/${LIB}/${VIDEO}`,
    );
    expect(url.searchParams.get('token')).toBe(expectedToken);
    expect(url.searchParams.get('expires')).toBe(String(expires));
    // token is 64 hex chars (sha256)
    expect(expectedToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('floors fractional now-seconds (Bunny expires is integer seconds)', () => {
    const svc = makeService({ BUNNY_TOKEN_AUTH_KEY: KEY, BUNNY_LIBRARY_ID: LIB });
    const { expires } = svc.signEmbedUrl(VIDEO, LIB, 1_000_000.987);
    expect(Number.isInteger(expires)).toBe(true);
    expect(expires).toBe(1_000_000 + 6 * 60 * 60);
  });

  it('falls back to BUNNY_LIBRARY_ID when no per-video library given', () => {
    const svc = makeService({ BUNNY_TOKEN_AUTH_KEY: KEY, BUNNY_LIBRARY_ID: LIB });
    const { embedUrl } = svc.signEmbedUrl(VIDEO, undefined, 1_000_000);
    expect(embedUrl).toContain(`/embed/${LIB}/${VIDEO}`);
  });

  it('throws when no signing key is configured', () => {
    const svc = makeService({ BUNNY_LIBRARY_ID: LIB });
    expect(svc.isConfigured()).toBe(false);
    expect(() => svc.signEmbedUrl(VIDEO, LIB, 1_000_000)).toThrow(
      /BUNNY_TOKEN_AUTH_KEY/,
    );
  });

  it('throws when no library id is available at all', () => {
    const svc = makeService({ BUNNY_TOKEN_AUTH_KEY: KEY });
    expect(() => svc.signEmbedUrl(VIDEO, undefined, 1_000_000)).toThrow(
      /library/i,
    );
  });

  it('different videos / different expiry yield different tokens', () => {
    const svc = makeService({ BUNNY_TOKEN_AUTH_KEY: KEY, BUNNY_LIBRARY_ID: LIB });
    const a = svc.signEmbedUrl(VIDEO, LIB, 1_000_000);
    const b = svc.signEmbedUrl('other-video', LIB, 1_000_000);
    const c = svc.signEmbedUrl(VIDEO, LIB, 2_000_000);
    const tok = (u: string) => new URL(u).searchParams.get('token');
    expect(tok(a.embedUrl)).not.toBe(tok(b.embedUrl));
    expect(tok(a.embedUrl)).not.toBe(tok(c.embedUrl));
  });
});
