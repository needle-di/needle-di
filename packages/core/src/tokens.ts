import { type AbstractClass, type Class, isClassLike } from "./utils.ts";
import { type Provider } from "./providers.ts";
import * as Guards from "./providers.ts";
import type { Container } from "./container.ts";

/**
 * A token is a reference to a service in the dependency injection (DI) container.
 * When obtaining a service from the container, you should use this token.
 */
export type Token<T> = Class<T> | AbstractClass<T> | string | symbol | InjectionToken<T>;

/**
 * A unique injection token object, that is used by reference. Can hold a generic type.
 * Can optionally hold an (async) factory.
 */
export class InjectionToken<T> {
  constructor(
    private description: string | symbol,
    public options?: InjectionTokenOptions<T>,
  ) {}

  public toString(): string {
    return `InjectionToken "${String(this.description)}"`;
  }
}

type InjectionTokenOptions<T> =
  | {
      async: true;
      factory: (container: Container) => Promise<T>;
    }
  | {
      async?: false;
      factory: (container: Container) => T;
    };

/**
 * Type-guard to check if a token is a class reference.
 *
 * @internal
 */
export function isClassToken<T>(token: Token<T>): token is Class<T> {
  return isClassLike(token);
}

/**
 * Type-guard to check if a token is an InjectionToken
 *
 * @internal
 */
export function isInjectionToken<T>(token: Token<T>): token is InjectionToken<T> {
  return token instanceof InjectionToken;
}

/**
 * Describes a token, useful for error messages.
 *
 * @internal
 */
export function toString<T>(token: Token<T>): string {
  if (isClassLike(token)) {
    return token.name;
  } else if (typeof token === "symbol") {
    return token.description ?? String(token);
  } else if (token instanceof InjectionToken) {
    return token.toString();
  } else {
    return token;
  }
}

/**
 * Returns the token for a provider.
 *
 * @internal
 */
export function getToken<T>(provider: Provider<T>): Token<T> {
  return Guards.isConstructorProvider(provider) ? provider : provider.provide;
}
