/**
 * StemUploadButton — LAUNCH-02.5c follow-up render tests.
 *
 * Covers the three visual states:
 *   - Empty: dashed "Upload .ogg" button visible
 *   - Uploaded: filename + Replace + Clear buttons visible
 *   - Clear: pressing the X button fires onChange('')
 *
 * The actual upload logic is exercised by useStemUpload.test.ts; this
 * test stubs the hook so we can drive button behaviour without
 * touching Supabase.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StemUploadButton } from '../StemUploadButton';

// Hoisted mock so we can swap the hook's return per test.
const { uploadMock, clearErrorMock, hookStateRef } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  clearErrorMock: vi.fn(),
  hookStateRef: {
    isUploading: false,
    error: null as string | null,
  },
}));

vi.mock('../useStemUpload', () => ({
  useStemUpload: () => ({
    isUploading: hookStateRef.isUploading,
    error: hookStateRef.error,
    upload: uploadMock,
    clearError: clearErrorMock,
  }),
}));

beforeEach(() => {
  uploadMock.mockReset();
  clearErrorMock.mockReset();
  hookStateRef.isUploading = false;
  hookStateRef.error = null;
});

const baseProps = {
  uploadContext: {
    tutorialSlug: 'foo',
    keyFolder: 'E',
    stem: 'bass' as const,
  },
  stemLabel: 'bass',
};

describe('StemUploadButton', () => {
  it('renders the empty state with a dashed upload button when value is ""', () => {
    render(<StemUploadButton {...baseProps} value="" onChange={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /upload bass stem/i }),
    ).toBeInTheDocument();
  });

  it('renders the uploaded state with filename + replace + clear when value is set', () => {
    const url =
      'https://example.supabase.co/storage/v1/object/public/audio-samples/grooves/foo/e/bass.ogg';
    render(<StemUploadButton {...baseProps} value={url} onChange={vi.fn()} />);
    // Filename derived from the URL's last path segment.
    expect(screen.getByText('bass.ogg')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /replace bass stem/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /clear bass stem/i }),
    ).toBeInTheDocument();
  });

  it('Clear button fires onChange("") and clearError()', () => {
    const onChange = vi.fn();
    render(
      <StemUploadButton
        {...baseProps}
        value="https://x/y/bass.ogg"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /clear bass stem/i }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(clearErrorMock).toHaveBeenCalled();
  });

  it('shows "Uploading…" copy and disables interaction during upload', () => {
    hookStateRef.isUploading = true;
    render(<StemUploadButton {...baseProps} value="" onChange={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /upload bass stem/i });
    expect(btn).toBeDisabled();
    expect(btn.textContent).toMatch(/uploading/i);
  });

  it('renders the hook error message under the button', () => {
    hookStateRef.error = 'Upload denied. Are you signed in as an admin?';
    render(<StemUploadButton {...baseProps} value="" onChange={vi.fn()} />);
    expect(screen.getByText(/upload denied/i)).toBeInTheDocument();
  });
});
