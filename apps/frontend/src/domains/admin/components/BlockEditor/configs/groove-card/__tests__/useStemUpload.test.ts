/**
 * useStemUpload — LAUNCH-02.5c follow-up tests.
 *
 * Covers:
 *   - buildStemPath / sanitisePathSegment: pure path-building rules
 *     (URL-safe segments, fallback values, semitone-offset folders)
 *   - validateFile: OGG-only acceptance + 8 MB size cap
 *   - useStemUpload happy path: success returns the public URL
 *   - useStemUpload upload error → friendly RLS denial message
 *   - useStemUpload bubbles unknown errors as-is
 *   - clearError resets the error state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// The hook now POSTs to the backend with the admin's session token.
// Mock supabase.auth.getSession() to provide a token, and stub global
// fetch to stand in for the backend endpoint.
const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

import { useStemUpload, _internal } from '../useStemUpload';

const PUBLIC_URL_BASE =
  'https://example.supabase.co/storage/v1/object/public/audio-samples';

function fakeOggFile(name = 'bass.ogg', size = 1024): File {
  // Real Blob with the right mime so the validator's type check passes.
  return new File([new ArrayBuffer(size)], name, { type: 'audio/ogg' });
}

/** Default: a valid admin session. */
function stubSession() {
  getSessionMock.mockResolvedValue({
    data: { session: { access_token: 'admin-jwt' } },
  });
}

/** Stub global fetch with a JSON response. */
function stubFetch(
  ok: boolean,
  status: number,
  body: Record<string, unknown>,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      status,
      json: async () => body,
    })),
  );
}

beforeEach(() => {
  getSessionMock.mockReset();
  stubSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('buildStemPath — pure path builder', () => {
  it('produces the canonical bucket-path layout', () => {
    const path = _internal.buildStemPath({
      tutorialSlug: 'economy-groove-1',
      keyFolder: 'E',
      stem: 'bass',
    });
    expect(path).toBe('grooves/economy-groove-1/e/bass.ogg');
  });

  it('sanitises slug and key (strips spaces / punctuation, lowercases)', () => {
    const path = _internal.buildStemPath({
      tutorialSlug: 'My  Funky  Groove!!',
      keyFolder: 'G♯',
      stem: 'drums',
    });
    // "G♯" → "g" (♯ stripped); slug normalised to dash-separated.
    expect(path).toBe('grooves/my-funky-groove/g/drums.ogg');
  });

  it('falls back to "untitled" / "unnamed" when inputs are empty', () => {
    const path = _internal.buildStemPath({
      tutorialSlug: '   ',
      keyFolder: '',
      stem: 'harmony',
    });
    expect(path).toBe('grooves/untitled/unnamed/harmony.ogg');
  });

  it('encodes leading +/- in semitone-offset folders so they never collide', () => {
    // Without sign preservation, "+4" and "-4" would both collapse
    // into "4/" — the +4 key set's stems would overwrite the -4
    // key set's stems on upload. The sanitiser encodes signs as
    // words to prevent that.
    expect(
      _internal.buildStemPath({
        tutorialSlug: 'g',
        keyFolder: '+4',
        stem: 'click',
      }),
    ).toBe('grooves/g/plus4/click.ogg');
    expect(
      _internal.buildStemPath({
        tutorialSlug: 'g',
        keyFolder: '-8',
        stem: 'click',
      }),
    ).toBe('grooves/g/minus8/click.ogg');
    expect(
      _internal.buildStemPath({
        tutorialSlug: 'g',
        keyFolder: '0',
        stem: 'click',
      }),
    ).toBe('grooves/g/0/click.ogg');
  });
});

describe('validateFile', () => {
  it('accepts an OGG file under the cap', () => {
    expect(_internal.validateFile(fakeOggFile('a.ogg', 1024))).toBeNull();
  });

  it('rejects a file over the 8 MB cap', () => {
    const big = fakeOggFile('big.ogg', _internal.MAX_FILE_BYTES + 1);
    const err = _internal.validateFile(big);
    expect(err).toMatch(/too large/i);
  });

  it('rejects a non-OGG mime + extension', () => {
    const mp3 = new File([new ArrayBuffer(10)], 'song.mp3', {
      type: 'audio/mpeg',
    });
    const err = _internal.validateFile(mp3);
    expect(err).toMatch(/OGG/i);
  });

  it('accepts a .ogg extension even when MIME is missing (some OSes omit it)', () => {
    const file = new File([new ArrayBuffer(10)], 'bass.ogg', { type: '' });
    expect(_internal.validateFile(file)).toBeNull();
  });
});

describe('useStemUpload — happy path (backend proxy)', () => {
  it('POSTs FormData to the backend with the bearer token and returns the public URL', async () => {
    const publicUrl = `${PUBLIC_URL_BASE}/grooves/foo/e/bass.ogg`;
    stubFetch(true, 200, { publicUrl, path: 'grooves/foo/e/bass.ogg' });

    const { result } = renderHook(() => useStemUpload());

    let returned: string | null = null;
    await act(async () => {
      returned = await result.current.upload(fakeOggFile(), {
        tutorialSlug: 'foo',
        keyFolder: 'E',
        stem: 'bass',
      });
    });

    expect(returned).toBe(publicUrl);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.error).toBeNull();

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/v1\/tutorials\/groove-stem\/upload$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer admin-jwt');
    // Body is FormData carrying file + path fields.
    const body = init.body as FormData;
    expect(body.get('slug')).toBe('foo');
    expect(body.get('keyFolder')).toBe('E');
    expect(body.get('stem')).toBe('bass');
    expect(body.get('file')).toBeInstanceOf(File);
  });
});

describe('useStemUpload — error surfaces', () => {
  it('renders a friendly hint on a 403 (not signed in as admin)', async () => {
    stubFetch(false, 403, { message: 'Forbidden' });

    const { result } = renderHook(() => useStemUpload());
    let returned: string | null = 'sentinel';
    await act(async () => {
      returned = await result.current.upload(fakeOggFile(), {
        tutorialSlug: 'foo',
        keyFolder: 'E',
        stem: 'bass',
      });
    });

    expect(returned).toBeNull();
    expect(result.current.error).toMatch(/admin/i);
  });

  it('surfaces the backend error message on other failures', async () => {
    stubFetch(false, 400, {
      message: 'Invalid file type: audio/mpeg (must be OGG Vorbis .ogg)',
    });

    const { result } = renderHook(() => useStemUpload());
    let returned: string | null = 'sentinel';
    await act(async () => {
      returned = await result.current.upload(fakeOggFile(), {
        tutorialSlug: 'foo',
        keyFolder: 'E',
        stem: 'bass',
      });
    });

    expect(returned).toBeNull();
    expect(result.current.error).toMatch(/OGG Vorbis/);
  });

  it('errors when there is no active session', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });
    stubFetch(true, 200, {}); // fetch should never be called

    const { result } = renderHook(() => useStemUpload());
    let returned: string | null = 'sentinel';
    await act(async () => {
      returned = await result.current.upload(fakeOggFile(), {
        tutorialSlug: 'foo',
        keyFolder: 'E',
        stem: 'bass',
      });
    });

    expect(returned).toBeNull();
    expect(result.current.error).toMatch(/session/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null without hitting the backend when file validation fails', async () => {
    stubFetch(true, 200, {});
    const { result } = renderHook(() => useStemUpload());
    const tooBig = fakeOggFile('huge.ogg', _internal.MAX_FILE_BYTES + 1);

    let returned: string | null = 'sentinel';
    await act(async () => {
      returned = await result.current.upload(tooBig, {
        tutorialSlug: 'foo',
        keyFolder: 'E',
        stem: 'bass',
      });
    });

    expect(returned).toBeNull();
    expect(result.current.error).toMatch(/too large/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('clearError() resets the error state', async () => {
    stubFetch(false, 400, { message: 'boom' });
    const { result } = renderHook(() => useStemUpload());

    await act(async () => {
      await result.current.upload(fakeOggFile(), {
        tutorialSlug: 'foo',
        keyFolder: 'E',
        stem: 'bass',
      });
    });
    expect(result.current.error).not.toBeNull();

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
