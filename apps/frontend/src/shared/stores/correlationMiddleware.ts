import { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { generateCorrelationId, createStructuredLogger } from '@bassnotion/contracts';

type Logger = ReturnType<typeof createStructuredLogger>;

export interface CorrelationSlice {
  _correlationId: string;
  _logger: Logger;
  getCorrelationId: () => string;
  withCorrelation: <T>(action: (correlationId: string) => T) => T;
}

type CorrelationMiddleware = <
  T extends object,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  f: StateCreator<T, Mps, [...Mcs, ['zustand/correlation', CorrelationSlice]]>,
  name?: string
) => StateCreator<T, Mps, Mcs>;

type CorrelationImpl = <T extends object>(
  f: StateCreator<T, [], []>,
  name?: string
) => StateCreator<T, [], []>;

type StoreWithCorrelation<T> = T & CorrelationSlice;

const correlationImpl: CorrelationImpl = (f, name = 'Store') => (set, get, api) => {
  const logger = createStructuredLogger(name);
  const storeCorrelationId = generateCorrelationId();
  
  // Create correlation slice
  const correlationSlice: CorrelationSlice = {
    _correlationId: storeCorrelationId,
    _logger: logger,
    getCorrelationId: () => storeCorrelationId,
    withCorrelation: (action) => {
      const actionCorrelationId = `${storeCorrelationId}-${Date.now()}`;
      logger.debug('Store action with correlation', { 
        correlationId: actionCorrelationId,
        storeName: name,
      });
      return action(actionCorrelationId);
    },
  };
  
  // Wrap set function to log state changes with correlation ID
  const loggedSet: typeof set = (partial, replace) => {
    const prevState = get();
    const nextState = typeof partial === 'function' ? partial(prevState) : partial;
    
    logger.debug('State update', {
      correlationId: storeCorrelationId,
      prevState,
      nextState,
      replace,
    });
    
    set(partial, replace);
  };
  
  // Create store with correlation slice
  const store = f(loggedSet, get, api);
  
  return {
    ...store,
    ...correlationSlice,
  };
};

export const correlation = correlationImpl as unknown as CorrelationMiddleware;

/**
 * Helper to create actions that automatically include correlation IDs
 */
export function createCorrelatedAction<TState, TArgs extends any[], TReturn>(
  storeName: string,
  actionName: string,
  action: (get: () => TState, set: (state: Partial<TState>) => void, correlationId: string, ...args: TArgs) => TReturn
) {
  const logger = createStructuredLogger(`${storeName}.${actionName}`);
  
  return (get: () => TState, set: (state: Partial<TState>) => void) => (...args: TArgs): TReturn => {
    const correlationId = generateCorrelationId();
    
    logger.debug('Action started', {
      correlationId,
      actionName,
      args,
    });
    
    try {
      const result = action(get, set, correlationId, ...args);
      
      // Handle async actions
      if (result instanceof Promise) {
        return result
          .then((value) => {
            logger.debug('Action completed', {
              correlationId,
              actionName,
              success: true,
            });
            return value;
          })
          .catch((error) => {
            logger.error('Action failed', error, {
              correlationId,
              actionName,
              args,
            });
            throw error;
          }) as TReturn;
      }
      
      logger.debug('Action completed', {
        correlationId,
        actionName,
        success: true,
      });
      
      return result;
    } catch (error) {
      logger.error('Action failed', error as Error, {
        correlationId,
        actionName,
        args,
      });
      throw error;
    }
  };
}

/**
 * Type helper for stores with correlation
 */
export type WithCorrelation<T> = T & CorrelationSlice;

/**
 * Example usage:
 * 
 * const useExampleStore = create<ExampleState>()(
 *   devtools(
 *     correlation(
 *       (set, get) => ({
 *         count: 0,
 *         increment: createCorrelatedAction(
 *           'ExampleStore',
 *           'increment',
 *           (get, set, correlationId) => {
 *             set({ count: get().count + 1 });
 *           }
 *         )(get, set),
 *       }),
 *       'ExampleStore'
 *     )
 *   )
 * );
 */