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

// Hoisted mock storage for the Supabase factory.
const { uploadMock, getPublicUrlMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      })),
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

beforeEach(() => {
  uploadMock.mockReset();
  getPublicUrlMock.mockReset();
});

afterEach(() => {
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

describe('useStemUpload — happy path', () => {
  it('uploads and returns the resolved public URL', async () => {
    uploadMock.mockResolvedValueOnce({ error: null });
    const publicUrl = `${PUBLIC_URL_BASE}/grooves/foo/e/bass.ogg`;
    getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl } });

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
    expect(uploadMock).toHaveBeenCalledWith(
      'grooves/foo/e/bass.ogg',
      expect.any(File),
      expect.objectContaining({ upsert: true, contentType: 'audio/ogg' }),
    );
  });
});

describe('useStemUpload — error surfaces', () => {
  it('renders a friendly hint when Supabase returns an RLS denial', async () => {
    uploadMock.mockResolvedValueOnce({
      error: { message: 'new row violates row-level security policy' },
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
    expect(result.current.error).toMatch(/admin/i);
  });

  it('surfaces unrelated Supabase errors verbatim', async () => {
    uploadMock.mockResolvedValueOnce({
      error: { message: 'bucket "audio-samples" not found' },
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
    expect(result.current.error).toMatch(/bucket/);
  });

  it('returns null without calling upload when file validation fails', async () => {
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
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('clearError() resets the error state', async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: 'boom' } });
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
