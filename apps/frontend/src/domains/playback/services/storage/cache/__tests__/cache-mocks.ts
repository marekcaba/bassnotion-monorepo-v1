/**
 * Comprehensive Cache Layer Mocks for Testing
 *
 * Provides realistic mocks for IndexedDB and ServiceWorker APIs
 * to enable comprehensive testing of distributed caching functionality.
 */

import { vi } from 'vitest';

// ===============================
// IndexedDB Mocks
// ===============================

export interface MockIDBRequest {
  result: any;
  error: DOMException | null;
  readyState: IDBRequestReadyState;
  source: any;
  transaction: any;
  onsuccess: ((ev: Event) => any) | null;
  onerror: ((ev: Event) => any) | null;
  onupgradeneeded: ((ev: Event) => any) | null;
}

export interface MockIDBDatabase {
  name: string;
  version: number;
  objectStoreNames: DOMStringList;
  close(): void;
  createObjectStore(
    name: string,
    options?: IDBObjectStoreParameters,
  ): MockIDBObjectStore;
  deleteObjectStore(name: string): void;
  transaction(
    storeNames: string | string[],
    mode?: IDBTransactionMode,
  ): MockIDBTransaction;
}

export interface MockIDBObjectStore {
  name: string;
  keyPath: string | string[] | null;
  indexNames: DOMStringList;
  add(value: any, key?: IDBValidKey): MockIDBRequest;
  put(value: any, key?: IDBValidKey): MockIDBRequest;
  get(key: IDBValidKey): MockIDBRequest;
  delete(key: IDBValidKey): MockIDBRequest;
  clear(): MockIDBRequest;
  createIndex(
    name: string,
    keyPath: string | string[],
    options?: IDBIndexParameters,
  ): void;
}

export interface MockIDBTransaction extends EventTarget {
  db: MockIDBDatabase;
  mode: IDBTransactionMode;
  objectStoreNames: DOMStringList;
  oncomplete: ((this: IDBTransaction, ev: Event) => any) | null;
  onerror: ((this: IDBTransaction, ev: Event) => any) | null;
  onabort: ((this: IDBTransaction, ev: Event) => any) | null;
  objectStore(name: string): MockIDBObjectStore;
  abort(): void;
}

class MockIndexedDB {
  private databases: Map<string, Map<string, any>> = new Map();
  private dbVersions: Map<string, number> = new Map();

  open(name: string, version?: number): MockIDBRequest {
    const request = this.createRequest();

    setTimeout(() => {
      try {
        // TODO: Review non-null assertion - consider null safety
        if (!this.databases.has(name)) {
          this.databases.set(name, new Map());
          this.dbVersions.set(name, version || 1);

          // Trigger upgrade if needed
          const upgradeEvent = {
            target: request,
            oldVersion: 0,
            newVersion: version || 1,
          };

          if (request.onupgradeneeded) {
            request.onupgradeneeded(upgradeEvent as any);
          }
        }

        const db = this.createDatabase(name, this.dbVersions.get(name) || 1);
        request.result = db;

        if (request.onsuccess) {
          request.onsuccess({} as Event);
        }
      } catch (error) {
        request.error = error as DOMException;
        if (request.onerror) {
          request.onerror({} as Event);
        }
      }
    }, 0);

    return request;
  }

  private createRequest(): MockIDBRequest {
    const request = Object.create(EventTarget.prototype) as MockIDBRequest;
    request.result = null;
    request.error = null;
    request.readyState = 'pending' as IDBRequestReadyState;
    request.source = null;
    request.transaction = null;
    request.onsuccess = null;
    request.onerror = null;
    request.onupgradeneeded = null;
    return request;
  }

  private createDatabase(name: string, version: number): MockIDBDatabase {
    const database =
      this.databases.get(name) ??
      (() => {
        throw new Error('Expected databases to contain name');
      })();

    return {
      name,
      version,
      objectStoreNames: {
        contains: (storeName: string) => database.has(storeName),
      } as DOMStringList,

      close: vi.fn(),

      createObjectStore: (
        storeName: string,
        _options?: IDBObjectStoreParameters,
      ) => {
        // TODO: Review non-null assertion - consider null safety
        if (!database.has(storeName)) {
          database.set(storeName, new Map());
        }
        return this.createObjectStore(name, storeName);
      },

      deleteObjectStore: (storeName: string) => {
        database.delete(storeName);
      },

      transaction: (
        storeNames: string | string[],
        mode: IDBTransactionMode = 'readonly',
      ) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        return this.createTransaction(name, names, mode);
      },
    };
  }

  private createObjectStore(
    dbName: string,
    storeName: string,
  ): MockIDBObjectStore {
    const database =
      this.databases.get(dbName) ??
      (() => {
        throw new Error('Expected databases to contain dbName');
      })();
    const store = database.get(storeName) || new Map();

    return {
      name: storeName,
      keyPath: 'sampleId',
      indexNames: {} as DOMStringList,

      add: (value: any, key?: IDBValidKey) => {
        return this.createStoreRequest(() => {
          const actualKey = key || value.sampleId;
          if (store.has(actualKey)) {
            throw new Error('Key already exists');
          }
          store.set(actualKey, value);
          database.set(storeName, store);
          return value;
        });
      },

      put: (value: any, key?: IDBValidKey) => {
        return this.createStoreRequest(() => {
          const actualKey = key || value.sampleId;
          store.set(actualKey, value);
          database.set(storeName, store);
          return value;
        });
      },

      get: (key: IDBValidKey) => {
        return this.createStoreRequest(() => {
          return store.get(key) || null;
        });
      },

      delete: (key: IDBValidKey) => {
        return this.createStoreRequest(() => {
          const existed = store.has(key);
          store.delete(key);
          database.set(storeName, store);
          return existed;
        });
      },

      clear: () => {
        return this.createStoreRequest(() => {
          store.clear();
          database.set(storeName, store);
          return undefined;
        });
      },

      createIndex: vi.fn(),
    };
  }

  private createTransaction(
    dbName: string,
    storeNames: string[],
    mode: IDBTransactionMode,
  ): MockIDBTransaction {
    const _database =
      this.databases.get(dbName) ??
      (() => {
        throw new Error('Expected databases to contain dbName');
      })();

    return Object.assign(Object.create(EventTarget.prototype), {
      db: this.createDatabase(dbName, this.dbVersions.get(dbName) || 1),
      mode,
      objectStoreNames: storeNames,
      oncomplete: null,
      onerror: null,
      onabort: null,

      objectStore: (name: string) => {
        // TODO: Review non-null assertion - consider null safety
        if (!storeNames.includes(name)) {
          throw new Error(`Store ${name} not in transaction scope`);
        }
        return this.createObjectStore(dbName, name);
      },

      abort: vi.fn(),
    });
  }

  private createStoreRequest(operation: () => any): MockIDBRequest {
    const request = this.createRequest();

    setTimeout(() => {
      try {
        request.result = operation();
        if (request.onsuccess) {
          request.onsuccess({} as Event);
        }
      } catch (error) {
        request.error = error as DOMException;
        if (request.onerror) {
          request.onerror({} as Event);
        }
      }
    }, 0);

    return request;
  }

  deleteDatabase(name: string): MockIDBRequest {
    const request = this.createRequest();

    setTimeout(() => {
      this.databases.delete(name);
      this.dbVersions.delete(name);
      request.result = undefined;
      if (request.onsuccess) {
        request.onsuccess({} as Event);
      }
    }, 0);

    return request;
  }
}

// ===============================
// Service Worker Cache Mocks
// ===============================

class MockCache {
  private storage: Map<string, Response> = new Map();

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const key = typeof request === 'string' ? request : request.toString();
    return this.storage.get(key);
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const key = typeof request === 'string' ? request : request.toString();
    // Clone the response to simulate browser behavior
    const clonedResponse = response.clone();
    this.storage.set(key, clonedResponse);
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    const key = typeof request === 'string' ? request : request.toString();
    return this.storage.delete(key);
  }

  async keys(): Promise<readonly Request[]> {
    return Array.from(this.storage.keys()).map((key) => new Request(key));
  }

  async add(request: RequestInfo | URL): Promise<void> {
    // Mock implementation - in real cache this would fetch from network
    const response = new Response('mock data');
    await this.put(request, response);
  }

  async addAll(requests: RequestInfo[]): Promise<void> {
    await Promise.all(requests.map((request) => this.add(request)));
  }
}

class MockCacheStorage {
  private caches: Map<string, MockCache> = new Map();

  async open(cacheName: string): Promise<MockCache> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.caches.has(cacheName)) {
      this.caches.set(cacheName, new MockCache());
    }
    return (
      this.caches.get(cacheName) ??
      (() => {
        throw new Error('Expected caches to contain cacheName');
      })()
    );
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.caches.delete(cacheName);
  }

  async has(cacheName: string): Promise<boolean> {
    return this.caches.has(cacheName);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.caches.keys());
  }

  async match(
    request: RequestInfo | URL,
    _options?: CacheQueryOptions,
  ): Promise<Response | undefined> {
    const cacheArray = Array.from(this.caches.values());
    for (const cache of cacheArray) {
      const response = await cache.match(request);
      if (response) {
        return response;
      }
    }
    return undefined;
  }
}

// ===============================
// Mock Setup Functions
// ===============================

export function setupIndexedDBMock(): MockIndexedDB {
  const mockIndexedDB = new MockIndexedDB();

  // Set up global mocks
  global.indexedDB = mockIndexedDB as any;
  global.IDBKeyRange = {
    bound: vi.fn(),
    lowerBound: vi.fn(),
    upperBound: vi.fn(),
    only: vi.fn(),
  } as any;

  return mockIndexedDB;
}

export function setupServiceWorkerCacheMock(): MockCacheStorage {
  const mockCacheStorage = new MockCacheStorage();
  global.caches = mockCacheStorage as any;

  // Mock Response constructor for tests
  // TODO: Review non-null assertion - consider null safety
  if (!global.Response) {
    global.Response = class MockResponse {
      private _body: string;
      private _headers: Headers;
      private _status: number;

      constructor(body?: BodyInit | null, init?: ResponseInit) {
        this._body = body ? body.toString() : '';
        this._headers = new Headers(init?.headers || {});
        this._status = init?.status || 200;
      }

      async json(): Promise<any> {
        try {
          return JSON.parse(this._body);
        } catch {
          return {};
        }
      }

      async text(): Promise<string> {
        return this._body;
      }

      clone(): Response {
        return new MockResponse(this._body, {
          status: this._status,
          headers: this._headers,
        }) as any;
      }

      get status() {
        return this._status;
      }
      get headers() {
        return this._headers;
      }
    } as any;
  }

  // TODO: Review non-null assertion - consider null safety
  if (!global.Headers) {
    global.Headers = class MockHeaders {
      private _headers: Map<string, string> = new Map();

      constructor(init?: HeadersInit) {
        if (init) {
          if (init instanceof Headers) {
            // Copy from another Headers object
            (init as any)._headers.forEach((value: string, key: string) => {
              this._headers.set(key.toLowerCase(), value);
            });
          } else if (Array.isArray(init)) {
            // From array of [name, value] pairs
            init.forEach(([name, value]) => {
              this._headers.set(name.toLowerCase(), value);
            });
          } else {
            // From object
            Object.entries(init).forEach(([name, value]) => {
              this._headers.set(name.toLowerCase(), value);
            });
          }
        }
      }

      set(name: string, value: string): void {
        this._headers.set(name.toLowerCase(), value);
      }

      get(name: string): string | null {
        return this._headers.get(name.toLowerCase()) || null;
      }

      has(name: string): boolean {
        return this._headers.has(name.toLowerCase());
      }

      delete(name: string): void {
        this._headers.delete(name.toLowerCase());
      }

      forEach(callback: (value: string, key: string) => void): void {
        this._headers.forEach(callback);
      }
    } as any;
  }

  return mockCacheStorage;
}

export function setupCacheMocks() {
  const indexedDB = setupIndexedDBMock();
  const cacheStorage = setupServiceWorkerCacheMock();

  return {
    indexedDB,
    cacheStorage,
  };
}

export function teardownCacheMocks() {
  // Clean up global mocks
  delete (global as any).indexedDB;
  delete (global as any).IDBKeyRange;
  delete (global as any).caches;
  delete (global as any).Response;
  delete (global as any).Headers;
}
