import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SignedEmbed {
  embedUrl: string;
  /** UNIX seconds at which the signed URL stops working. */
  expires: number;
}

/**
 * Mints Bunny Stream "Embed View Token Authentication" URLs.
 *
 * Bunny algorithm (confirmed from docs.bunny.net/stream/token-authentication):
 *   expires = nowSeconds + ttl
 *   token   = sha256_hex( TOKEN_AUTH_KEY + videoId + expires )      // hex, NOT base64
 *   url     = https://iframe.mediadelivery.net/embed/{lib}/{video}?token={token}&expires={expires}
 *
 * The TOKEN_AUTH_KEY is the library's "Token Authentication Key" from the Bunny
 * dashboard — it is a SECRET and lives ONLY here (server-side). Once token-auth
 * is enabled on the library, a bare embed URL (no token) returns 403, so this
 * signer becomes the only way to play a video.
 */
@Injectable()
export class BunnyVideoService {
  private readonly logger = new Logger(BunnyVideoService.name);
  private readonly tokenKey: string | undefined;
  private readonly defaultLibraryId: string | undefined;
  /** Signed-URL lifetime: 6h — covers a practice session; a leaked URL dies same-day. */
  private readonly ttlSeconds = 6 * 60 * 60;

  constructor(private readonly configService: ConfigService) {
    this.tokenKey = this.configService.get<string>('BUNNY_TOKEN_AUTH_KEY');
    this.defaultLibraryId =
      this.configService.get<string>('BUNNY_LIBRARY_ID') ?? undefined;
    if (!this.tokenKey) {
      this.logger.warn(
        'BUNNY_TOKEN_AUTH_KEY not set — video signing will fail. Set it in the backend env once Bunny token-auth is enabled.',
      );
    }
  }

  /** True only when the signing key is configured. */
  isConfigured(): boolean {
    return !!this.tokenKey;
  }

  /**
   * Sign an embed URL for a specific video. `nowSeconds` is injected so the
   * caller controls the clock (and tests are deterministic).
   */
  signEmbedUrl(
    videoId: string,
    libraryId: string | undefined,
    nowSeconds: number,
  ): SignedEmbed {
    if (!this.tokenKey) {
      throw new Error('BUNNY_TOKEN_AUTH_KEY is not configured');
    }
    const lib = libraryId ?? this.defaultLibraryId;
    if (!lib) {
      throw new Error(
        'No Bunny library id (neither per-video nor BUNNY_LIBRARY_ID default)',
      );
    }

    const expires = Math.floor(nowSeconds) + this.ttlSeconds;
    const token = createHash('sha256')
      .update(this.tokenKey + videoId + expires)
      .digest('hex');

    const embedUrl =
      `https://iframe.mediadelivery.net/embed/${lib}/${videoId}` +
      `?token=${token}&expires=${expires}`;

    return { embedUrl, expires };
  }
}
