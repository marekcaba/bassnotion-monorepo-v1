export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export class ResultUtils {
  static ok<T>(value: T): Result<T> {
    return { ok: true, value };
  }

  static fail<E = Error>(error: E): Result<never, E> {
    return { ok: false, error };
  }

  static fromPromise<T>(promise: Promise<T>): Promise<Result<T>> {
    return promise
      .then((value) => ({ ok: true, value }) as Result<T>)
      .catch((error) => ({ ok: false, error }) as Result<T>);
  }

  static isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
    return result.ok === true;
  }

  static isFail<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
    return result.ok === false;
  }

  static map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    if (result.ok) {
      return { ok: true, value: fn(result.value) };
    }
    return result;
  }

  static flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>,
  ): Result<U, E> {
    if (result.ok) {
      return fn(result.value);
    }
    return result;
  }

  static combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];

    for (const result of results) {
      if (!result.ok) {
        return result;
      }
      values.push(result.value);
    }

    return { ok: true, value: values };
  }
}

// Helper type for extracting success value type
export type SuccessValue<T> = T extends Result<infer U, any> ? U : never;

// Helper type for extracting error type
export type FailureError<T> = T extends Result<any, infer E> ? E : never;

// Convenience methods for Result pattern
export class Result<T, E = Error> {
  private constructor(
    private readonly _ok: boolean,
    private readonly value?: T,
    private readonly error?: E,
  ) {}

  static success<T>(value: T): Result<T, never> {
    return new Result(true, value, undefined) as Result<T, never>;
  }

  static failure<E>(error: E): Result<never, E> {
    return new Result(false, undefined, error) as Result<never, E>;
  }

  // Alias methods for compatibility
  static ok<T>(value: T): Result<T, never> {
    return Result.success(value);
  }

  static fail<E>(error: E): Result<never, E> {
    return Result.failure(error);
  }

  get ok(): boolean {
    return this._ok;
  }

  isSuccess(): this is Result<T, never> {
    return this._ok;
  }

  isFailure(): this is Result<never, E> {
    return !this._ok;
  }

  getValue(): T | undefined {
    return this.value;
  }

  getError(): E | undefined {
    return this.error;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isSuccess() && this.value !== undefined) {
      return Result.success(fn(this.value));
    }
    return Result.failure(this.error!) as Result<U, E>;
  }

  mapError<F>(fn: (error: E) => F): Result<T, F> {
    if (this.isFailure() && this.error !== undefined) {
      return Result.failure(fn(this.error));
    }
    return Result.success(this.value!) as Result<T, F>;
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this.isSuccess() && this.value !== undefined) {
      return fn(this.value);
    }
    return Result.failure(this.error!) as Result<U, E>;
  }

  orElse<U>(defaultValue: U): T | U {
    return this.value ?? defaultValue;
  }

  orThrow(): T {
    if (this.isSuccess() && this.value !== undefined) {
      return this.value;
    }
    throw this.error;
  }
}