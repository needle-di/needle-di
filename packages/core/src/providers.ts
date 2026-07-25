import type { Token } from "./tokens.ts";
import { type Class, isClassLike } from "./utils.ts";
import type { Container } from "./container.ts";

/**
 * A provider states how, for a given token, a service should be constructed.
 */
export type Provider<T> = SyncProvider<T> | AsyncProvider<T>;

/**
 * A provider that provides synchronously, allowing a non-blocking process.
 */
export type SyncProvider<T> =
  | ConstructorProvider<T>
  | ClassProvider<T>
  | ValueProvider<T>
  | SyncFactoryProvider<T>
  | ExistingProvider<T>;

/**
 * A provider that provides asynchronously, enforcing an awaitable process.
 */
export type AsyncProvider<T> = AsyncFactoryProvider<T>;

/**
 * A factory provider refers to a value which is lazily returned.
 */
export type FactoryProvider<T> = SyncFactoryProvider<T> | AsyncFactoryProvider<T>;

/**
 * A constructor provider refers to a class constructor,
 * which is the same class as the token itself.
 */
export type ConstructorProvider<T> = Class<T>;

/**
 * A class provider refers to a class constructor,
 * which may be the same class as the token, or a subclass.
 */
export interface ClassProvider<T> {
  provide: Token<T>;
  useClass: Class<NoInfer<T>>;
  multi?: true;
}

/**
 * Provides a static value.
 */
export interface ValueProvider<T> {
  provide: Token<T>;
  useValue: T;
  multi?: true;
}

/**
 * Provides a value which is lazily returned by a synchronous factory function.
 */
export interface SyncFactoryProvider<T> {
  provide: Token<T>;
  async?: false;
  multi?: true;
  useFactory: (container: Container) => NoInfer<T>;
}

/**
 * Provides a value which is lazily returned by an asynchronous factory function.
 */
export interface AsyncFactoryProvider<T> {
  provide: Token<T>;
  async: true;
  multi?: true;
  useFactory: (container: Container) => Promise<NoInfer<T>>;
}

/**
 * Provides a value that is provided by another provider.
 */
export interface ExistingProvider<T> {
  provide: Token<T>;
  useExisting: Token<T>;
  multi?: boolean;
}

export function isConstructorProvider<T>(provider: Provider<T>): provider is ConstructorProvider<T> {
  return isClassLike(provider);
}

export function isClassProvider<T>(provider: Provider<T>): provider is ClassProvider<T> {
  return "provide" in provider && "useClass" in provider;
}

export function isValueProvider<T>(provider: Provider<T>): provider is ValueProvider<T> {
  return "provide" in provider && "useValue" in provider;
}

export function isFactoryProvider<T>(provider: Provider<T>): provider is FactoryProvider<T> {
  return "provide" in provider && "useFactory" in provider;
}

export function isAsyncProvider<T>(provider: Provider<T>): provider is AsyncProvider<T> {
  return isFactoryProvider(provider) && provider.async === true;
}

export function isExistingProvider<T>(provider: Provider<T>): provider is ExistingProvider<T> {
  return "provide" in provider && "useExisting" in provider;
}

export function isMultiProvider<T>(provider: Provider<T>): boolean {
  return "provide" in provider && "multi" in provider && provider.multi === true;
}

type ExtractProviders<T> = T extends unknown[] ? ExtractProviders<T[number]> : T;

type CheckProviderNode<T> = T extends unknown[]
  ? CheckProviders<T>
  : T extends { provide: Token<infer U> }
    ? Provider<U>
    : Provider<unknown>;
export type CheckProviders<T extends unknown[]> = {
  [K in keyof T]: CheckProviderNode<T[K]>;
};

/**
 * Define a list of providers
 * {@link https://needle-di.io/concepts/binding.html#binding-multiple-values}
 */
export function defineProviders<T extends unknown[]>(
  ...providers: [...T] extends CheckProviders<T> ? T : CheckProviders<T>
): ExtractProviders<T>[] {
  return providers.flat(Infinity) as unknown as ExtractProviders<T>[];
}
