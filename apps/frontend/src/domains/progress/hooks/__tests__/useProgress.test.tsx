import React, { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { GetTutorialProgressResponse } from '@bassnotion/contracts';

import {
  useProgress,
  useCompleteBlock,
  useRecordPractice,
  progressKeys,
} from '../useProgress';
import * as progressApi from '../../api/progress.api';

vi.mock('../../api/progress.api');

const mockedFetch = vi.mocked(progressApi.fetchTutorialProgress);
const mockedComplete = vi.mocked(progressApi.completeBlock);
const mockedRecord = vi.mocked(progressApi.recordPractice);

const SLUG = 'find-notes-on-fretboard';

function makeResponse(
  overrides: Partial<GetTutorialProgressResponse> = {},
): GetTutorialProgressResponse {
  return {
    tutorialId: 'tutorial-1',
    blocks: [
      {
        blockId: 'b0',
        completed: false,
        unlocked: true,
        completedAt: null,
      },
      {
        blockId: 'b1',
        completed: false,
        unlocked: false,
        completedAt: null,
      },
    ],
    exercises: [],
    ...overrides,
  };
}

function createWrapper() {
  // NOTE: gcTime is intentionally Infinity. With gcTime: 0 the cache evicts
  // entries the moment no observer is mounted, which collides with the way
  // tests use queryClient.setQueryData to seed initial state — by the time
  // the next assertion runs, the seeded value has been GC'd.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryDelay: 0,
        staleTime: 0,
        gcTime: Infinity,
      },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { Wrapper, queryClient };
}

describe('useProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when slug is falsy', () => {
    const { Wrapper } = createWrapper();

    renderHook(() => useProgress(undefined), { wrapper: Wrapper });

    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('does not fetch when caller disables the query', () => {
    const { Wrapper } = createWrapper();

    renderHook(() => useProgress(SLUG, { enabled: false }), {
      wrapper: Wrapper,
    });

    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('fetches progress when slug is provided and enabled', async () => {
    const response = makeResponse();
    mockedFetch.mockResolvedValue(response);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useProgress(SLUG), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedFetch).toHaveBeenCalledWith(SLUG);
    expect(result.current.data).toEqual(response);
  });

  it('uses a stable query key per slug', () => {
    expect(progressKeys.tutorial(SLUG)).toEqual([
      'progress',
      'tutorial',
      SLUG,
    ]);
  });
});

describe('useCompleteBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the API and writes the response into the query cache', async () => {
    const initial = makeResponse();
    const afterComplete = makeResponse({
      blocks: [
        {
          blockId: 'b0',
          completed: true,
          unlocked: true,
          completedAt: '2026-05-20T13:00:00Z',
        },
        {
          blockId: 'b1',
          completed: false,
          unlocked: true,
          completedAt: null,
        },
      ],
    });
    mockedComplete.mockResolvedValue(afterComplete);

    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(progressKeys.tutorial(SLUG), initial);

    const { result } = renderHook(() => useCompleteBlock(SLUG), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ blockId: 'b0' });
    });

    expect(mockedComplete).toHaveBeenCalledWith(SLUG, 'b0', undefined);
    expect(queryClient.getQueryData(progressKeys.tutorial(SLUG))).toEqual(
      afterComplete,
    );
  });

  it('forwards the data payload to the API', async () => {
    mockedComplete.mockResolvedValue(makeResponse());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCompleteBlock(SLUG), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        blockId: 'b0',
        data: { quizScore: 4 },
      });
    });

    expect(mockedComplete).toHaveBeenCalledWith(SLUG, 'b0', {
      quizScore: 4,
    });
  });

  it('does not mutate the cache when the API call fails', async () => {
    const initial = makeResponse();
    mockedComplete.mockRejectedValue(new Error('boom'));

    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(progressKeys.tutorial(SLUG), initial);

    const { result } = renderHook(() => useCompleteBlock(SLUG), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ blockId: 'b0' }).catch(() => {});
    });

    expect(queryClient.getQueryData(progressKeys.tutorial(SLUG))).toEqual(
      initial,
    );
  });
});

describe('useRecordPractice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the API with the tempo and updates the cache', async () => {
    const afterPractice = makeResponse({
      exercises: [
        { exerciseId: 'ex1', completionCount: 1, lastTempoBpm: 100 },
      ],
    });
    mockedRecord.mockResolvedValue(afterPractice);

    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(progressKeys.tutorial(SLUG), makeResponse());

    const { result } = renderHook(() => useRecordPractice(SLUG), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ exerciseId: 'ex1', tempoBpm: 100 });
    });

    expect(mockedRecord).toHaveBeenCalledWith(SLUG, 'ex1', 100);
    expect(queryClient.getQueryData(progressKeys.tutorial(SLUG))).toEqual(
      afterPractice,
    );
  });

  it('omits tempo when not supplied', async () => {
    mockedRecord.mockResolvedValue(makeResponse());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useRecordPractice(SLUG), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ exerciseId: 'ex1' });
    });

    expect(mockedRecord).toHaveBeenCalledWith(SLUG, 'ex1', undefined);
  });
});
