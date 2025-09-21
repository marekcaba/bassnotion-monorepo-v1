export class Result<T> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _error?: string,
    private readonly _value?: T,
  ) {}

  get isSuccess(): boolean {
    return this._isSuccess;
  }

  get isFailure(): boolean {
    return !this._isSuccess;
  }

  get error(): string {
    if (this._isSuccess) {
      throw new Error('Cannot get error from a successful result');
    }
    return this._error!;
  }

  get value(): T {
    if (!this._isSuccess) {
      throw new Error('Cannot get value from a failed result');
    }
    return this._value!;
  }

  getValueOrDefault(defaultValue: T): T {
    return this._isSuccess ? this._value! : defaultValue;
  }

  map<U>(fn: (value: T) => U): Result<U> {
    if (!this._isSuccess) {
      return Result.fail<U>(this._error!);
    }
    try {
      return Result.ok(fn(this._value!));
    } catch (error) {
      return Result.fail<U>((error as Error).message);
    }
  }

  async mapAsync<U>(fn: (value: T) => Promise<U>): Promise<Result<U>> {
    if (!this._isSuccess) {
      return Result.fail<U>(this._error!);
    }
    try {
      const result = await fn(this._value!);
      return Result.ok(result);
    } catch (error) {
      return Result.fail<U>((error as Error).message);
    }
  }

  static ok<T>(value: T): Result<T> {
    return new Result<T>(true, undefined, value);
  }

  static fail<T>(error: string): Result<T> {
    return new Result<T>(false, error);
  }

  static combine(results: Result<any>[]): Result<any> {
    for (const result of results) {
      if (result.isFailure) {
        return result;
      }
    }
    return Result.ok(results.map((r) => r.value));
  }
}
