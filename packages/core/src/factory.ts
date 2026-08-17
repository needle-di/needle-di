import { type Provider, type SyncProvider } from "./providers.ts";
import { getToken, type Token, toString } from "./tokens.ts";
import * as Guards from "./providers.ts";
import { assertNever, retryOn } from "./utils.ts";
import { Container } from "./container.ts";
import { type Context, injectionContext } from "./context.ts";

/**
 * The providers that are currently being constructed, ordered from the root of a
 * resolution down to the provider that is being constructed right now.
 *
 * A chain belongs to a single resolution and is treated as immutable: every nested
 * injection receives its own extended copy. This is what keeps concurrent resolutions
 * isolated. A single mutable stack shared by the whole container would interleave
 * them, and any provider two overlapping resolutions have in common would be reported
 * as a circular dependency.
 *
 * @internal
 */
export type ResolutionChain = readonly Provider<unknown>[];

/**
 * Asserts that constructing `provider` as the next step of `chain` does not close a
 * cycle, i.e., that the provider does not (transitively) depend on itself.
 *
 * @internal
 */
export function assertNoCycle(chain: ResolutionChain, provider: Provider<unknown>): void {
  if (chain.includes(provider)) {
    throw new CircularDependencyError([...chain, provider].map(getToken).map(toString));
  }
}

/**
 * Returns the chain that the dependencies of `provider` should be resolved with.
 * Throws a {@link CircularDependencyError} if `provider` is already part of `chain`.
 */
function extend(chain: ResolutionChain, provider: Provider<unknown>): ResolutionChain {
  assertNoCycle(chain, provider);
  return [...chain, provider];
}

/**
 * @internal
 */
export class Factory {
  constructor(private readonly container: Container) {}

  construct<T>(provider: Provider<T>, token: Token<T>, chain: ResolutionChain): T[] {
    if (Guards.isAsyncProvider(provider)) {
      throw new AsyncProvidersInSyncInjectionContextError(token);
    }

    return this.doConstruct(provider, extend(chain, provider));
  }

  async constructAsync<T>(provider: Provider<T>, chain: ResolutionChain): Promise<T[]> {
    // The chain that this provider's own dependencies are resolved with. Since it is a
    // fresh array rather than a shared stack, there is nothing to unwind afterwards:
    // it simply goes out of scope, no matter when (or whether) this construction settles.
    const nested = extend(chain, provider);

    if (Guards.isAsyncProvider(provider)) {
      return [await this.enter(nested).runAsync(() => provider.useFactory(this.container))];
    }

    // in class and constructor providers, we allow stuff to be synchronously injected,
    // by just retrying when we encounter an async dependency down the road.
    // todo: this feels like an ugly workaround, so let's create something nice for this.
    if (Guards.isClassProvider(provider) || Guards.isConstructorProvider(provider)) {
      const create = Guards.isConstructorProvider(provider) ? () => [new provider()] : () => [new provider.useClass()];

      return retryOn(
        AsyncProvidersInSyncInjectionContextError,
        // retries run in a later tick, when the original injection context is no longer
        // active, so each attempt must explicitly (re-)enter the injection context for
        // the field initializers' inject() calls to work.
        async () => this.enter(nested).run(() => create()),
        async (error) => {
          // Resolving the async dependency is part of this construction, so it has to
          // continue this chain. Entering the context again is what carries it across
          // the tick boundary introduced by the retry.
          await this.enter(nested).runAsync(() =>
            this.container.getAsync(error.token, { multi: true, optional: true }),
          );
        },
      );
    }

    if (Guards.isExistingProvider(provider)) {
      return await this.enter(nested).runAsync(() => this.container.getAsync(provider.useExisting, { multi: true }));
    }

    // all other types of providers are constructed synchronously anyway.
    return this.doConstruct(provider, nested);
  }

  private doConstruct<T>(provider: SyncProvider<T>, chain: ResolutionChain): T[] {
    // User code runs inside the injection context, so that the inject() calls it makes
    // resolve from the right container and continue this resolution's chain.
    return this.enter(chain).run(() => {
      if (Guards.isConstructorProvider(provider)) {
        return [new provider()];
      } else if (Guards.isClassProvider(provider)) {
        return [new provider.useClass()];
      } else if (Guards.isValueProvider(provider)) {
        return [provider.useValue];
      } else if (Guards.isFactoryProvider(provider)) {
        return [provider.useFactory(this.container)];
      } else if (Guards.isExistingProvider(provider)) {
        return this.container.get(provider.useExisting, { multi: true });
      }

      return assertNever(provider);
    });
  }

  private enter(chain: ResolutionChain): Context {
    return injectionContext(this.container, chain);
  }
}

/**
 * An error that occurs when an async provider is requested in a synchronous context.
 *
 * @internal
 */
class AsyncProvidersInSyncInjectionContextError<T> extends Error {
  constructor(public token: Token<T>) {
    super(
      `Some providers for token ${toString(token)} are async, please use injectAsync() or container.getAsync() instead`,
    );
  }
}

class CircularDependencyError extends Error {
  constructor(graph: string[]) {
    super(
      `Detected circular dependency: ${graph.join(" -> ")}. Please change your dependency graph or use lazy injection instead.`,
    );
  }
}
