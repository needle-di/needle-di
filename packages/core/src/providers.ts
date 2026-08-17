import type { Token } from "./tokens.ts";
import { type Class, flattenDeep, isClassLike } from "./utils.ts";
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

/**
 * A single provider, or an arbitrarily nested array of providers.
 */
type ProviderNode = Provider<unknown> | readonly ProviderNode[];

/**
 * Recursively unwraps nested arrays, yielding the union of all leaf types.
 */
type ExtractProviders<T> = T extends readonly unknown[] ? ExtractProviders<T[number]> : T;

/**
 * Every provider variant that is an object literal, i.e. all of them except
 * {@link ConstructorProvider}, which is a class reference.
 */
type ObjectProvider<T> =
  | ClassProvider<T>
  | ValueProvider<T>
  | SyncFactoryProvider<T>
  | AsyncFactoryProvider<T>
  | ExistingProvider<T>;

/**
 * `keyof` distributed over the members of a union, rather than the keys they have in common.
 */
type KeysOfUnion<T> = T extends unknown ? keyof T : never;

/**
 * Every property name that may appear on an object-based provider.
 */
type ProviderKey = KeysOfUnion<ObjectProvider<unknown>>;

/**
 * Rejects properties that do not exist on any provider, by requiring them to be `never`.
 *
 * TypeScript only applies its built-in excess property check to *fresh* object literals.
 * Since {@link ProviderList} first captures the arguments in an inferred type parameter,
 * that freshness is lost, so the check is reproduced here explicitly.
 */
type NoExcessProperties<T> = Record<Exclude<keyof T, ProviderKey>, never>;

/**
 * Type-checks a single element: either a nested array, or a provider whose value type
 * is correlated with the token it is provided for.
 */
type CheckProviderNode<T> = T extends readonly unknown[]
  ? CheckedProviderList<T>
  : T extends { provide: Token<infer U> }
    ? // only intersect when there is something to reject, to keep error messages readable
      Exclude<keyof T, ProviderKey> extends never
      ? Provider<U>
      : Provider<U> & NoExcessProperties<T>
    : Provider<unknown>;

/**
 * Type-checks every element of an (arbitrarily nested) list of providers.
 */
type CheckedProviderList<T extends readonly unknown[]> = {
  [K in keyof T]: CheckProviderNode<T[K]>;
};

/**
 * The list of arguments accepted by {@link Container.bindAll} and {@link defineProviders}:
 * one or more providers, optionally nested in arrays, preserving the correlation between each
 * token and the value it provides.
 *
 * When the given arguments already satisfy this, they are accepted as-is. Otherwise this type
 * resolves to the expected shape, so that TypeScript reports the mismatch on the offending
 * element rather than on the call as a whole.
 */
export type ProviderList<T extends readonly unknown[]> = T extends readonly []
  ? readonly [ProviderNode]
  : T extends CheckedProviderList<T>
    ? T
    : CheckedProviderList<T>;

/**
 * Defines a list of providers upfront, outside of a container.
 *
 * Providers may be passed individually or as (nested) arrays, and are returned as a single
 * flattened array. Unlike annotating a variable as `Provider<unknown>[]`, this preserves the
 * correlation between each token and the value it provides.
 *
 * @param providers one or more providers, optionally nested in arrays
 * @returns a flat array containing every given provider
 *
 * {@link https://needle-di.io/concepts/binding.html#defining-providers-upfront}
 */
export function defineProviders<T extends readonly unknown[]>(...providers: ProviderList<T>): ExtractProviders<T>[] {
  return flattenDeep(providers as readonly unknown[]);
}
