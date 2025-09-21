import {
  useQuery,
  useMutation,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { useCorrelation } from './useCorrelation';
import { globalErrorHandler } from '@/shared/utils/errorHandling';

/**
 * Enhanced useQuery hook that includes correlation ID support
 */
export function useQueryWithCorrelation<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends readonly unknown[] = readonly unknown[],
>(
  queryKey: TQueryKey,
  queryFn: (context: { correlationId: string }) => Promise<TQueryFnData>,
  options?: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    'queryKey' | 'queryFn'
  >,
  componentName?: string,
) {
  const { correlationId, logger } = useCorrelation(componentName || 'Query');

  return useQuery({
    queryKey,
    queryFn: async () => {
      logger.debug('Query started', {
        queryKey,
        correlationId,
      });

      try {
        const result = await queryFn({ correlationId });
        logger.debug('Query succeeded', {
          queryKey,
          correlationId,
        });
        return result;
      } catch (error) {
        logger.error('Query failed', error as Error, {
          queryKey,
          correlationId,
        });

        // Ensure error has correlation ID
        if (error instanceof Error) {
          globalErrorHandler.handleError(
            error,
            correlationId,
            `query-${queryKey.join('-')}`,
          );
        }

        throw error;
      }
    },
    ...options,
    onError: (error: TError) => {
      // Call original onError if provided
      options?.onError?.(error);

      // Log with correlation ID
      logger.error('Query error handler triggered', error as Error, {
        queryKey,
        correlationId,
      });
    },
  });
}

/**
 * Enhanced useMutation hook that includes correlation ID support
 */
export function useMutationWithCorrelation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(
  mutationFn: (
    variables: TVariables,
    context: { correlationId: string },
  ) => Promise<TData>,
  options?: Omit<
    UseMutationOptions<TData, TError, TVariables, TContext>,
    'mutationFn'
  >,
  componentName?: string,
) {
  const { correlationId: baseCorrelationId, logger } = useCorrelation(
    componentName || 'Mutation',
  );

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      // Generate a new correlation ID for each mutation
      const mutationCorrelationId = `${baseCorrelationId}-mut-${Date.now()}`;

      logger.debug('Mutation started', {
        variables,
        correlationId: mutationCorrelationId,
      });

      try {
        const result = await mutationFn(variables, {
          correlationId: mutationCorrelationId,
        });
        logger.debug('Mutation succeeded', {
          correlationId: mutationCorrelationId,
        });
        return result;
      } catch (error) {
        logger.error('Mutation failed', error as Error, {
          variables,
          correlationId: mutationCorrelationId,
        });

        // Ensure error has correlation ID
        if (error instanceof Error) {
          globalErrorHandler.handleError(
            error,
            mutationCorrelationId,
            `mutation-${componentName}`,
          );
        }

        throw error;
      }
    },
    ...options,
    onError: (error: TError, variables: TVariables, context?: TContext) => {
      // Call original onError if provided
      options?.onError?.(error, variables, context);

      // Log with correlation ID
      logger.error('Mutation error handler triggered', error as Error, {
        variables,
        correlationId: baseCorrelationId,
      });
    },
  });
}

/**
 * Create query/mutation hooks with built-in correlation support
 */
export function createCorrelatedHooks(componentName: string) {
  return {
    useQuery: <
      TQueryFnData = unknown,
      TError = unknown,
      TData = TQueryFnData,
      TQueryKey extends readonly unknown[] = readonly unknown[],
    >(
      queryKey: TQueryKey,
      queryFn: (context: { correlationId: string }) => Promise<TQueryFnData>,
      options?: Omit<
        UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
        'queryKey' | 'queryFn'
      >,
    ) => useQueryWithCorrelation(queryKey, queryFn, options, componentName),

    useMutation: <
      TData = unknown,
      TError = unknown,
      TVariables = void,
      TContext = unknown,
    >(
      mutationFn: (
        variables: TVariables,
        context: { correlationId: string },
      ) => Promise<TData>,
      options?: Omit<
        UseMutationOptions<TData, TError, TVariables, TContext>,
        'mutationFn'
      >,
    ) => useMutationWithCorrelation(mutationFn, options, componentName),
  };
}
