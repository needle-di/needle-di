import { type Token, isClassToken, toString, isInjectionToken, getToken } from "./tokens.ts";
import * as Guards from "./providers.ts";
import type { Provider } from "./providers.ts";
import { getInjectableTargets, isInjectable } from "./decorators.ts";
import { assertPresent, assertSingle, getParentClasses, promiseTry, windowedSlice } from "./utils.ts";
import { Factory } from "./factory.ts";
import { injectionContext } from "./context.ts";

/**
 * A dependency injection (DI) container will keep track of all bindings
 * and hold the actual instances of your services.
 */
export class Container {
  private readonly providers: ProviderMap = new Map();
  private readonly singletons: SingletonMap = new Map();

  private readonly parent?: Container;
  private readonly factory: Factory;

  constructor(parent?: Container) {
    this.parent = parent;
    this.factory = new Factory(this);
    this.bind({
      provide: Container,
      useValue: this,
    });
  }

  /**
   * Binds multiple providers to this container.
   *
   * {@link https://needle-di.io/concepts/binding.html#binding}
   */
  public bindAll<A>(p1: Provider<A>): this;
  public bindAll<A, B>(p1: Provider<A>, p2: Provider<B>): this;
  public bindAll<A, B, C>(p1: Provider<A>, p2: Provider<B>, p3: Provider<C>): this;
  public bindAll<A, B, C, D>(p1: Provider<A>, p2: Provider<B>, p3: Provider<C>, p4: Provider<D>): this;
  public bindAll<A, B, C, D, E>(
    p1: Provider<A>,
    p2: Provider<B>,
    p3: Provider<C>,
    p4: Provider<D>,
    p5: Provider<E>,
  ): this;
  public bindAll<A, B, C, D, E, F>(
    p1: Provider<A>,
    p2: Provider<B>,
    p3: Provider<C>,
    p4: Provider<D>,
    p5: Provider<E>,
    p6: Provider<F>,
  ): this;
  // noinspection JSUnusedGlobalSymbols
  public bindAll<A, B, C, D, E, F, G>(
    p1: Provider<A>,
    p2: Provider<B>,
    p3: Provider<C>,
    p4: Provider<D>,
    p5: Provider<E>,
    p6: Provider<F>,
    p7: Provider<G>,
  ): this;
  public bindAll<A, B, C, D, E, F, G, H>(
    p1: Provider<A>,
    p2: Provider<B>,
    p3: Provider<C>,
    p4: Provider<D>,
    p5: Provider<E>,
    p6: Provider<F>,
    p7: Provider<G>,
    p8: Provider<H>,
  ): this;
  // noinspection JSUnusedGlobalSymbols
  public bindAll<A, B, C, D, E, F, G, H, I>(
    p1: Provider<A>,
    p2: Provider<B>,
    p3: Provider<C>,
    p4: Provider<D>,
    p5: Provider<E>,
    p6: Provider<F>,
    p7: Provider<G>,
    p8: Provider<H>,
    p9: Provider<I>,
  ): this;
  public bindAll<A, B, C, D, E, F, G, H, I>(
    p1: Provider<A>,
    p2: Provider<B>,
    p3: Provider<C>,
    p4: Provider<D>,
    p5: Provider<E>,
    p6: Provider<F>,
    p7: Provider<G>,
    p8: Provider<H>,
    p9: Provider<I>,
    // eslint-disable-next-line
    ...providers: Provider<any>[]
  ): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public bindAll(...providers: Provider<any>[]): this {
    providers.forEach((it) => this.bind(it));
    return this;
  }

  /**
   * Binds a provider to this container.
   *
   * {@link https://needle-di.io/concepts/binding.html#binding}
   */
  public bind<T>(provider: Provider<T>): this {
    const token = getToken(provider);

    // running some validations...
    if (Guards.isExistingProvider(provider) && provider.provide === provider.useExisting) {
      throw Error(`The provider for token ${toString(token)} with "useExisting" cannot refer to itself.`);
    }

    if (!Guards.isExistingProvider(provider) && this.singletons.has(token)) {
      throw Error(
        `Cannot bind a new provider for ${toString(token)}, since the existing provider was already constructed.`,
      );
    }

    // ignore the new provider if it was already provided
    if (
      Guards.isExistingProvider(provider) &&
      Guards.isMultiProvider(provider) &&
      this.existingProviderAlreadyProvided(token, provider.useExisting)
    ) {
      return this;
    }

    const providers = this.providers.get(token) ?? [];

    // validating multi-provider inconsistencies...
    const multi = Guards.isMultiProvider(provider);

    if (multi && providers.some((it) => !Guards.isMultiProvider(it))) {
      throw Error(
        `Cannot bind ${toString(token)} as multi-provider, since there is already a provider which is not a multi-provider.`,
      );
    } else if (!multi && providers.some((it) => Guards.isMultiProvider(it))) {
      if (!providers.every(Guards.isExistingProvider)) {
        throw Error(
          `Cannot bind ${toString(token)} as provider, since there are already provider(s) that are multi-providers.`,
        );
      }
    }

    // appending or replacing providers...
    this.providers.set(token, multi ? [...providers, provider] : [provider]);

    // inheritance support: also bind parent classes to their immediate child classes
    if (isClassToken(token) && (Guards.isClassProvider(provider) || Guards.isConstructorProvider(provider))) {
      windowedSlice([token, ...getParentClasses(token)]).forEach(([childClass, parentClass]) => {
        const parentProvider: Provider<typeof childClass> = {
          provide: parentClass,
          useExisting: childClass,
          multi: true,
        };
        const existingParentProviders = this.providers.get(parentClass) ?? [];
        if (!this.existingProviderAlreadyProvided(parentClass, childClass)) {
          this.providers.set(parentClass, [...existingParentProviders, parentProvider]);
        }
      });
    }

    return this;
  }

  /**
   * Retrieves a service from this container.
   *
   * {@link https://needle-di.io/concepts/containers.html}
   */
  public get<T>(token: Token<T>): T;
  public get<T>(token: Token<T>, options: { multi: true }): T[];
  public get<T>(token: Token<T>, options: { optional: true }): T | undefined;
  public get<T>(token: Token<T>, options: { multi: true; optional: true }): T[] | undefined;
  public get<T>(token: Token<T>, options: { lazy: true }): () => T;
  public get<T>(token: Token<T>, options: { lazy: true; multi: true }): () => T[];
  public get<T>(token: Token<T>, options: { lazy: true; optional: true }): () => T | undefined;
  public get<T>(token: Token<T>, options: { lazy: true; multi: true; optional: true }): () => T[] | undefined;
  public get<T>(token: Token<T>, options?: { optional?: boolean; multi?: boolean; lazy?: false }): T | T[] | undefined;
  public get<T>(
    token: Token<T>,
    options?: { optional?: boolean; multi?: boolean; lazy?: boolean },
  ): T | T[] | undefined | (() => T | T[] | undefined);
  public get<T>(
    token: Token<T>,
    options?: { optional?: boolean; multi?: boolean; lazy?: boolean },
  ): T | T[] | undefined | (() => T | T[] | undefined) {
    const lazy = options?.lazy ?? false;

    if (lazy) {
      return () => this.get(token, { ...options, lazy: false });
    }

    this.autoBindIfNeeded(token);

    const optional = options?.optional ?? false;

    if (!this.providers.has(token)) {
      if (this.parent) {
        return this.parent.get(token, { ...options, lazy: false });
      }
      if (optional) {
        return undefined;
      }
      throw Error(`No provider(s) found for ${toString(token)}`);
    }

    const providers = assertPresent(this.providers.get(token));

    if (!this.singletons.has(token)) {
      injectionContext(this).run(() => {
        const values = providers.flatMap((provider) => this.factory.construct(provider, token));
        this.singletons.set(token, values);
      });
    }

    const singletons = assertPresent(this.singletons.get(token));
    const multi = options?.multi ?? false;

    if (multi) {
      return singletons;
    } else {
      return assertSingle(singletons, () =>
        Error(
          `Requesting a single value for ${toString(token)}, but multiple values were provided. ` +
            `Consider passing "{ multi: true }" to inject all values, or adjust your bindings accordingly.`,
        ),
      );
    }
  }

  /**
   * Retrieves a service from this container asynchronously.
   *
   * {@link https://needle-di.io/advanced/async-injection.html}
   */
  public getAsync<T>(token: Token<T>): Promise<T>;
  public getAsync<T>(token: Token<T>, options: { multi: true }): Promise<T[]>;
  public getAsync<T>(token: Token<T>, options: { optional: true }): Promise<T | undefined>;
  public getAsync<T>(token: Token<T>, options: { multi: true; optional: true }): Promise<T[] | undefined>;
  public getAsync<T>(token: Token<T>, options: { lazy: true }): () => Promise<T>;
  public getAsync<T>(token: Token<T>, options: { lazy: true; multi: true }): () => Promise<T[]>;
  public getAsync<T>(token: Token<T>, options: { lazy: true; optional: true }): () => Promise<T | undefined>;
  public getAsync<T>(
    token: Token<T>,
    options: { lazy: true; multi: true; optional: true },
  ): () => Promise<T[] | undefined>;
  public getAsync<T>(
    token: Token<T>,
    options?: {
      optional?: boolean;
      multi?: boolean;
      lazy?: false;
    },
  ): Promise<T | T[] | undefined>;
  public getAsync<T>(
    token: Token<T>,
    options?: {
      optional?: boolean;
      multi?: boolean;
      lazy?: boolean;
    },
  ): Promise<T | T[] | undefined> | (() => Promise<T | T[] | undefined>);
  public getAsync<T>(
    token: Token<T>,
    options?: {
      optional?: boolean;
      multi?: boolean;
      lazy?: boolean;
    },
  ): Promise<T | T[] | undefined> | (() => Promise<T | T[] | undefined>) {
    const lazy = options?.lazy ?? false;

    if (lazy) {
      return () => this.getAsync(token, { ...options, lazy: false });
    }

    return promiseTry(async () => {
      this.autoBindIfNeeded(token);

      const optional = options?.optional ?? false;

      if (!this.providers.has(token)) {
        if (optional) {
          return undefined;
        }
        throw Error(`No provider(s) found for ${toString(token)}`);
      }

      const providers = assertPresent(this.providers.get(token));

      if (!this.singletons.has(token)) {
        await injectionContext(this).runAsync(async () => {
          const values = await Promise.all(providers.map((it) => this.factory.constructAsync(it)));

          this.singletons.set(token, values.flat());
        });
      }

      const singletons = assertPresent(this.singletons.get(token));
      const multi = options?.multi ?? false;

      if (multi) {
        return singletons;
      } else {
        return assertSingle(
          singletons,
          () =>
            new Error(
              `Requesting a single value for ${toString(token)}, but multiple values were provided. ` +
                `Consider passing "{ multi: true }" to inject all values, or adjust your bindings accordingly.`,
            ),
        );
      }
    });
  }

  /**
   * Creates a child container.
   *
   * {@link https://needle-di.io/advanced/child-containers.html}
   */
  public createChild(): Container {
    return new Container(this);
  }

  /**
   * Returns whether the container has one or more providers for this token.
   */
  public has<T>(token: Token<T>): boolean {
    let found = this.providers.has(token);
    if (!found && this.parent) {
      return this.parent.has(token);
    }
    return found;
  }

  private autoBindIfNeeded<T>(token: Token<T>) {
    if (this.singletons.has(token)) {
      return;
    }

    if (isClassToken(token) && isInjectable(token)) {
      const targetClasses = getInjectableTargets(token);

      targetClasses
        .filter((targetClass) => !this.providers.has(targetClass))
        .forEach((targetClass) => {
          this.bind({
            provide: targetClass,
            useClass: targetClass,
            multi: true,
          });
        });
    } else if (!this.providers.has(token) && isInjectionToken(token) && token.options?.factory) {
      const async = token.options.async;
      if (!async) {
        this.bind({
          provide: token,
          async: false,
          useFactory: token.options.factory,
        });
      } else if (async) {
        this.bind({
          provide: token,
          async: true,
          useFactory: token.options.factory,
        });
      }
    }
  }

  private existingProviderAlreadyProvided(token: Token<unknown>, existingToken: Token<unknown>) {
    return (this.providers.get(token) ?? []).some(
      (it) => Guards.isExistingProvider(it) && it.provide === token && it.useExisting === existingToken,
    );
  }
}

interface ProviderMap extends Map<Token<unknown>, Provider<unknown>[]> {
  get<T>(key: Token<T>): Provider<T>[] | undefined;

  set<T>(key: Token<T>, value: Provider<T>[]): this;
}

interface SingletonMap extends Map<Token<unknown>, unknown[]> {
  get<T>(token: Token<T>): T[] | undefined;

  set<T>(token: Token<T>, value: T[]): this;
}

/**
 * Bootstraps a new container and obtains a service using the provided token.
 */
export function bootstrap<T>(token: Token<T>): T {
  return new Container().get(token);
}

/**
 * Bootstraps a new container and obtains a service asynchronously using the provided token.
 */
export function bootstrapAsync<T>(token: Token<T>): Promise<T> {
  return new Container().getAsync(token);
}
