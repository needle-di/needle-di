import { type AbstractClass, type Class, getParentClasses } from "./utils.ts";
import { DEFAULT_SCOPE, type Scope } from "./scopes.ts";

/**
 * The @injectable() decorator allows you to automatically bind a class as singleton service
 * when requesting it from a DI container.
 *
 * Pass a `scope` to control which container it is auto-bound on, and therefore how widely
 * its instance is shared.
 *
 * {@link https://needle-di.io/advanced/scopes.html}
 */
export function injectable<C extends Class<unknown>>(options?: InjectableOptions): ClassDecorator<C> {
  return (target) => {
    getParentClasses(target).forEach((parentClass) => {
      if (!Object.getOwnPropertyDescriptor(parentClass, injectableSymbol)) {
        Object.defineProperty(parentClass, injectableSymbol, {
          value: [target],
          writable: true,
          enumerable: false,
        });
      } else {
        const injectableParentClass = parentClass as InjectableClass;
        injectableParentClass[injectableSymbol] = [...injectableParentClass[injectableSymbol], target];
      }
    });

    Object.defineProperty(target, injectableSymbol, {
      value: [target],
      writable: true,
    });

    // Defined even when no scope was passed: classes inherit static properties from their
    // parent class, so a subclass would otherwise silently adopt the scope of its base.
    Object.defineProperty(target, scopeSymbol, {
      value: options?.scope ?? DEFAULT_SCOPE,
      writable: true,
      enumerable: false,
    });
  };
}

export interface InjectableOptions {
  /**
   * How widely the instance of this class is shared. Defaults to `Scope.ROOT`.
   */
  scope?: Scope;
}

export type InjectableClass<T = unknown> = (Class<T> | AbstractClass<T>) & { [injectableSymbol]: Class<unknown>[] };

export const injectableSymbol = Symbol("injectable");

export const scopeSymbol = Symbol("scope");

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
type ClassDecorator<C extends Class<unknown>> = (target: C) => C | void;

export function isInjectable<T>(target: AbstractClass<T>): target is InjectableClass<T> {
  // eslint-disable-next-line no-prototype-builtins
  return target.hasOwnProperty(injectableSymbol);
}

export function getInjectableTargets<T>(target: InjectableClass<T>): Class<unknown>[] {
  return target[injectableSymbol];
}

/**
 * Returns the scope a class was annotated with. Only own properties are considered, so a
 * class never reports the scope of its parent class.
 *
 * @internal
 */
export function getScope<T>(target: Class<T> | AbstractClass<T>): Scope {
  // eslint-disable-next-line no-prototype-builtins
  return target.hasOwnProperty(scopeSymbol) ? (target as unknown as ScopedClass)[scopeSymbol] : DEFAULT_SCOPE;
}

interface ScopedClass {
  [scopeSymbol]: Scope;
}
