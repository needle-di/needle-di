import { Container } from "./container.ts";
import type { ResolutionChain } from "./factory.ts";
import type { Token } from "./tokens.ts";
import { promiseTry } from "./utils.ts";

/**
 * Injects a service within the current injection context, using the token provided.
 */
export function inject<T>(token: Token<T>): T;
export function inject<T>(token: Token<T>, options: { multi: true }): T[];
export function inject<T>(token: Token<T>, options: { optional: true }): T | undefined;
export function inject<T>(token: Token<T>, options: { multi: true; optional: true }): T[] | undefined;
export function inject<T>(token: Token<T>, options: { lazy: true }): () => T;
export function inject<T>(token: Token<T>, options: { lazy: true; multi: true }): () => T[];
export function inject<T>(token: Token<T>, options: { lazy: true; optional: true }): () => T | undefined;
export function inject<T>(token: Token<T>, options: { lazy: true; multi: true; optional: true }): () => T[] | undefined;
export function inject<T>(
  token: Token<T>,
  options?: { optional?: boolean; multi?: boolean; lazy?: boolean },
): T | T[] | undefined | (() => T | T[] | undefined) {
  try {
    return _currentContext.run((container) => container.get(token, options));
  } catch (error) {
    if (error instanceof NeedsInjectionContextError && options?.optional === true) {
      return undefined;
    }

    throw error;
  }
}

/**
 * Injects a service asynchronously within the current injection context, using the token provided.
 */
export function injectAsync<T>(token: Token<T>): Promise<T>;
export function injectAsync<T>(token: Token<T>, options: { multi: true }): Promise<T[]>;
export function injectAsync<T>(token: Token<T>, options: { optional: true }): Promise<T | undefined>;
export function injectAsync<T>(token: Token<T>, options: { multi: true; optional: true }): Promise<T[] | undefined>;
export function injectAsync<T>(token: Token<T>, options: { lazy: true }): () => Promise<T>;
export function injectAsync<T>(token: Token<T>, options: { lazy: true; multi: true }): () => Promise<T[]>;
export function injectAsync<T>(token: Token<T>, options: { lazy: true; optional: true }): () => Promise<T | undefined>;
export function injectAsync<T>(
  token: Token<T>,
  options: { lazy: true; multi: true; optional: true },
): () => Promise<T[] | undefined>;
export function injectAsync<T>(
  token: Token<T>,
  options?: {
    optional?: boolean;
    multi?: boolean;
    lazy?: boolean;
  },
): Promise<T | T[] | undefined> | (() => Promise<T | T[] | undefined>) {
  try {
    if (options?.lazy) {
      return _currentContext.run((container) => container.getAsync(token, { ...options, lazy: true }));
    }
    return _currentContext.runAsync((container) => container.getAsync(token, { ...options, lazy: false }));
  } catch (error) {
    if (error instanceof NeedsInjectionContextError && options?.optional === true) {
      return Promise.resolve(undefined);
    }

    return Promise.reject(error);
  }
}

/**
 * The chain of a resolution that has no parent, i.e., one started from user code.
 */
const EMPTY_RESOLUTION_CHAIN: ResolutionChain = Object.freeze([]);

/**
 * A context has a specific container associated to it and allows you to run sync or async code.
 *
 * It also carries the {@link ResolutionChain} of the resolution it belongs to, so that
 * `inject()` and `injectAsync()` calls made by user code continue that chain instead of
 * starting a new one.
 *
 * @internal
 */
export interface Context {
  readonly chain: ResolutionChain;

  run<T>(block: (container: Container) => T): T;
  runAsync<T>(block: (container: Container) => Promise<T>): Promise<T>;
}

/**
 * The global context does not allow dependency injection.
 *
 * @internal
 */
class GlobalContext implements Context {
  readonly chain: ResolutionChain = EMPTY_RESOLUTION_CHAIN;

  run<T>(): T {
    throw new NeedsInjectionContextError();
  }

  runAsync<T>(): Promise<T> {
    throw new NeedsInjectionContextError();
  }
}

/**
 * An injection context allows to perform dependency injection with `inject()` and `injectAsync()`.
 *
 * @internal
 */
class InjectionContext implements Context {
  constructor(
    private readonly container: Container,
    public readonly chain: ResolutionChain,
  ) {}

  run<T>(block: (container: Container) => T): T {
    const originalContext = _currentContext;
    try {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      _currentContext = this;
      return block(this.container);
    } finally {
      _currentContext = originalContext;
    }
  }

  runAsync<T>(block: (container: Container) => Promise<T> | T): Promise<T> {
    const originalContext = _currentContext;
    try {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      _currentContext = this;
      return promiseTry(() => block(this.container));
    } finally {
      // The context must be restored synchronously, as soon as the block's synchronous
      // prefix has returned its promise. Holding it across the `await` (i.e. until the
      // promise settles) leaks this context to unrelated code that runs while the block
      // is suspended, making `inject()`/`injectAsync()` resolve from the wrong container.
      _currentContext = originalContext;
    }
  }
}

let _currentContext: GlobalContext | InjectionContext = new GlobalContext();

/**
 * Creates a new injection context.
 *
 * @internal
 */
export function injectionContext(container: Container, chain: ResolutionChain = EMPTY_RESOLUTION_CHAIN): Context {
  return new InjectionContext(container, chain);
}

/**
 * Returns the resolution chain of the injection context that is currently active, or an
 * empty chain when there is none (i.e., when a resolution is started from user code).
 *
 * Like `inject()` and `injectAsync()`, this must be read synchronously while the context
 * is still active: the context is restored as soon as the current synchronous block
 * returns, so it cannot be read after an `await`.
 *
 * @internal
 */
export function currentResolutionChain(): ResolutionChain {
  return _currentContext.chain;
}

/**
 * An error that occurs when `inject()` or `injectAsync()` is used outside an injection context.
 *
 * @internal
 */
class NeedsInjectionContextError extends Error {
  constructor() {
    super(`You can only invoke inject() or injectAsync() within an injection context`);
  }
}
