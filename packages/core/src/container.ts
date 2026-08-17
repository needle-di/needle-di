import { type Token, isClassToken, toString, isInjectionToken, getToken } from "./tokens.ts";
import * as Guards from "./providers.ts";
import type { Provider, ProviderList } from "./providers.ts";
import { getInjectableTargets, isInjectable } from "./decorators.ts";
import { assertPresent, assertSingle, flattenDeep, getParentClasses, promiseTry, windowedSlice } from "./utils.ts";
import { assertNoCycle, Factory, type ResolutionChain } from "./factory.ts";
import { currentResolutionChain } from "./context.ts";

/**
 * A dependency injection (DI) container will keep track of all bindings
 * and hold the actual instances of your services.
 */
export class Container {
  private readonly providers: ProviderMap = new Map();
  private readonly singletons: SingletonMap = new Map();

  /**
   * Async constructions that have been started but have not settled yet, keyed by token.
   *
   * Without this, two overlapping `getAsync()` calls for the same token would both see an
   * empty `singletons` entry and construct it twice, breaking singleton semantics.
   */
  private readonly pending: PendingMap = new Map();

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
   * Providers may be passed individually or as (nested) arrays. To define a list of providers
   * upfront, outside of a container, use `defineProviders()`.
   *
   * @param providers one or more providers, optionally nested in arrays
   *
   * {@link https://needle-di.io/concepts/binding.html#binding-multiple-providers}
   */
  public bindAll<T extends readonly unknown[]>(...providers: ProviderList<T>): this {
    flattenDeep<Provider<unknown>>(providers as readonly unknown[]).forEach((it) => this.bind(it));
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
   * Unbinds a provider.
   *
   * {@link https://needle-di.io/concepts/binding.html#binding}
   */
  public unbind<T>(provider: Provider<T>): this {
    const token = getToken(provider);

    this.providers.delete(token);
    this.singletons.delete(token);
    this.pending.delete(token);

    return this;
  }

  /**
   * Unbinds all providers.
   *
   * {@link https://needle-di.io/concepts/binding.html#binding}
   */
  public unbindAll(): this {
    this.providers.clear();
    this.singletons.clear();
    this.pending.clear();

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
      // Lazy injection deliberately starts a new resolution when the getter is invoked,
      // which is exactly what makes it usable to break a cycle.
      return () => this.get(token, { ...options, lazy: false });
    }

    // The resolution we are part of, if any. Read from the active injection context
    // rather than passed as an argument, so that the public API stays unchanged.
    const chain = currentResolutionChain();

    this.autoBindIfNeeded(token);

    const optional = options?.optional ?? false;

    if (!this.providers.has(token)) {
      if (this.parent) {
        // Delegation happens synchronously, so the context this chain was read from is
        // still active and the parent observes the very same chain.
        return this.parent.get(token, { ...options, lazy: false });
      }
      if (optional) {
        return undefined;
      }
      throw Error(`No provider(s) found for ${toString(token)}`);
    }

    const providers = assertPresent(this.providers.get(token));

    if (!this.singletons.has(token)) {
      const values = providers.flatMap((provider) => this.factory.construct(provider, token, chain));
      this.singletons.set(token, values);
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
      // Lazy injection deliberately starts a new resolution when the getter is invoked,
      // which is exactly what makes it usable to break a cycle.
      return () => this.getAsync(token, { ...options, lazy: false });
    }

    // Must be read here, before the first `await`: the injection context we inherit this
    // from is restored as soon as our caller's synchronous block returns.
    const chain = currentResolutionChain();

    return promiseTry(async () => {
      this.autoBindIfNeeded(token);

      const optional = options?.optional ?? false;

      if (!this.providers.has(token)) {
        if (this.parent) {
          // Still part of the synchronous prefix, so the context is active and the parent
          // observes the very same chain.
          return this.parent.getAsync(token, { ...options, lazy: false });
        }
        if (optional) {
          return undefined;
        }
        throw Error(`No provider(s) found for ${toString(token)}`);
      }

      const providers = assertPresent(this.providers.get(token));

      if (!this.singletons.has(token)) {
        // Cycle detection has to happen before we join an in-flight construction below:
        // a genuine cycle would otherwise await the pending promise of a token that is
        // waiting on us, and hang instead of reporting itself.
        providers.forEach((provider) => assertNoCycle(chain, provider));

        await this.constructOnce(token, providers, chain);
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
    return this.providers.has(token) || (this.parent?.has(token) ?? false);
  }

  /**
   * Constructs the providers for a token asynchronously, ensuring that concurrent
   * requests for the same token share a single construction and therefore a single
   * instance. Callers that join an already running construction inherit its result,
   * not its chain: their own chain has already been checked for cycles by the caller.
   */
  private constructOnce<T>(token: Token<T>, providers: Provider<T>[], chain: ResolutionChain): Promise<void> {
    let pending = this.pending.get(token);

    if (!pending) {
      pending = promiseTry(async () => {
        const values = await Promise.all(providers.map((it) => this.factory.constructAsync(it, chain)));
        return values.flat();
      });

      this.pending.set(token, pending);

      // Registered before the promise is handed out, so that by the time any caller
      // resumes, the singleton is already recorded and `pending` is cleaned up.
      pending.then(
        (values) => {
          this.pending.delete(token);
          this.singletons.set(token, values);
        },
        () => {
          // A failed construction must not be cached, so a later attempt can retry.
          this.pending.delete(token);
        },
      );
    }

    return pending.then(() => undefined);
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

interface PendingMap extends Map<Token<unknown>, Promise<unknown[]>> {
  get<T>(token: Token<T>): Promise<T[]> | undefined;

  set<T>(token: Token<T>, value: Promise<T[]>): this;
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
