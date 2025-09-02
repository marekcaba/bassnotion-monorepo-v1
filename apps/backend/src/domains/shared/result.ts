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
