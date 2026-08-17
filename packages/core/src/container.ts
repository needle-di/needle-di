import { type Token, isClassToken, toString, isInjectionToken, getToken } from "./tokens.ts";
import * as Guards from "./providers.ts";
import type { Provider, ProviderList } from "./providers.ts";
import { getInjectableTargets, getScope, isInjectable } from "./decorators.ts";
import {
  assertPresent,
  assertSingle,
  type Class,
  flattenDeep,
  getParentClasses,
  promiseTry,
  windowedSlice,
} from "./utils.ts";
import { assertNoCycle, Factory, type ResolutionChain } from "./factory.ts";
import { currentResolutionChain, injectionContext } from "./context.ts";
import { DEFAULT_SCOPE, Scope } from "./scopes.ts";

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

  /**
   * Tokens on this container whose providers were registered by auto-binding rather than
   * by the user. Auto-binding may replace them, an explicit binding it may never touch.
   */
  private readonly autoBound = new Set<Token<unknown>>();

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
   * Unbinds a token.
   *
   * This removes all providers for that token, including multi-providers,
   * as well as any instances that were already constructed.
   *
   * {@link https://needle-di.io/concepts/binding.html#clear-binding}
   */
  public unbind<T>(token: Token<T>): this {
    this.providers.delete(token);
    this.singletons.delete(token);
    this.pending.delete(token);
    this.autoBound.delete(token);

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
    this.autoBound.clear();

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

      let singletons = this.singletons.get(token);

      if (!singletons) {
        // Cycle detection has to happen before we join an in-flight construction below:
        // a genuine cycle would otherwise await the pending promise of a token that is
        // waiting on us, and hang instead of reporting itself.
        providers.forEach((provider) => assertNoCycle(chain, provider));

        // We use the values the construction produced instead of reading `singletons`
        // back, so that a token that was unbound while we were suspended still resolves
        // to the result of the construction we started.
        singletons = await this.constructOnce(token, providers, chain);
      }

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
   * Runs a function within an injection context backed by this container, so that it
   * can use `inject()` and `injectAsync()` instead of `container.get()`. The return
   * value of the function is passed through.
   *
   * The injection context is only active for as long as the function runs
   * synchronously. When passing an async function, `inject()` and `injectAsync()`
   * must therefore be called before its first `await`.
   *
   * {@link https://needle-di.io/concepts/injection.html#running-in-an-injection-context}
   */
  public runInInjectionContext<T>(block: (container: Container) => T): T {
    // A fresh context per call, never one cached per container: contexts are scoped to
    // a single resolution, and sharing one would interleave concurrent resolutions.
    //
    // The chain is inherited rather than reset. Called from user code it is empty
    // anyway, but called from within a construction the block is part of that
    // resolution, so continuing its chain is what keeps circular dependencies
    // detectable instead of recursing until the stack overflows.
    return injectionContext(this, currentResolutionChain()).run(block);
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
  private constructOnce<T>(token: Token<T>, providers: Provider<T>[], chain: ResolutionChain): Promise<T[]> {
    const existing = this.pending.get(token);

    if (existing) {
      return existing;
    }

    const pending = promiseTry(async () => {
      const values = await Promise.all(providers.map((it) => this.factory.constructAsync(it, chain)));
      return values.flat();
    });

    this.pending.set(token, pending);

    // A construction may only write back if it is still the current one for this token.
    // If it was unbound or superseded while in flight, the container has moved on and
    // storing the result would resurrect a token that is no longer bound.
    const isCurrent = () => this.pending.get(token) === pending;

    pending.then(
      (values) => {
        if (isCurrent()) {
          this.pending.delete(token);
          this.singletons.set(token, values);
        }
      },
      () => {
        // A failed construction must not be cached, so a later attempt can retry.
        if (isCurrent()) {
          this.pending.delete(token);
        }
      },
    );

    return pending;
  }

  private autoBindIfNeeded<T>(token: Token<T>) {
    if (this.singletons.has(token)) {
      return;
    }

    if (isClassToken(token) && isInjectable(token)) {
      const targetClasses = getInjectableTargets(token);
      const scope = this.scopeOf(token, targetClasses);

      targetClasses
        .filter((targetClass) => !this.isAlreadyProvided(targetClass, scope))
        .forEach((targetClass) => {
          this.containerFor(scope).autoBind({
            provide: targetClass,
            useClass: targetClass,
            multi: true,
          });
        });
    } else if (isInjectionToken(token) && token.options?.factory) {
      const { async, factory, scope = DEFAULT_SCOPE } = token.options;

      if (this.isAlreadyProvided(token, scope)) {
        return;
      }

      this.containerFor(scope).autoBind(
        async
          ? { provide: token, async: true, useFactory: factory }
          : { provide: token, async: false, useFactory: factory },
      );
    }
  }

  /**
   * The container an auto-binding for this scope belongs on. Since a provider is resolved
   * by the container that owns it, this is also the container the dependencies of the
   * auto-bound service are resolved against.
   */
  private containerFor(scope: Scope): Container {
    return scope === Scope.CONTAINER ? this : this.root;
  }

  private get root(): Container {
    return this.parent?.root ?? this;
  }

  /**
   * The scope shared by all classes that auto-bind under this token.
   *
   * A token that resolves to several classes can only be honoured if they agree: their
   * providers would otherwise end up on different containers, and since multi-providers
   * are not merged across containers, the ones bound higher up would silently disappear.
   */
  private scopeOf<T>(token: Token<T>, targetClasses: Class<unknown>[]): Scope {
    const scopes = new Set(targetClasses.map(getScope));

    if (scopes.size > 1) {
      const declarations = targetClasses.map((it) => `${it.name} (${getScope(it)})`).join(", ");

      throw Error(
        `Cannot auto-bind ${toString(token)}, since the classes it resolves to declare different scopes: ` +
          `${declarations}. Give them the same scope, or bind them explicitly.`,
      );
    }

    return scopes.values().next().value ?? DEFAULT_SCOPE;
  }

  /**
   * Whether auto-binding should leave this token alone, either because someone bound it
   * explicitly, or because the container this scope binds on already provides it.
   */
  private isAlreadyProvided<T>(token: Token<T>, scope: Scope): boolean {
    return this.hasExplicitBinding(token) || this.containerFor(scope).providers.has(token);
  }

  /**
   * Whether this container or any of its ancestors has a provider for this token that did
   * not come from auto-binding. Explicit bindings always win: auto-binding a class on a
   * child would otherwise shadow the override its parent deliberately registered.
   */
  private hasExplicitBinding<T>(token: Token<T>): boolean {
    if (this.providers.has(token) && !this.autoBound.has(token)) {
      return true;
    }

    return this.parent?.hasExplicitBinding(token) ?? false;
  }

  private autoBind<T>(provider: Provider<T>): void {
    const token = getToken(provider);

    // Binding a class also registers its parent classes, which are just as auto-bound.
    // Only the ones without a provider yet, so an explicit binding keeps its status.
    const parentClasses = isClassToken(token) ? getParentClasses(token).filter((it) => !this.providers.has(it)) : [];

    this.bind(provider);

    this.autoBound.add(token);
    parentClasses.forEach((it) => this.autoBound.add(it));
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
