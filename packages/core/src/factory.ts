import { type Provider, type SyncProvider } from "./providers.ts";
import { getToken, type Token, toString } from "./tokens.ts";
import * as Guards from "./providers.ts";
import { assertNever, retryOn } from "./utils.ts";
import { Container } from "./container.ts";

/**
 * @internal
 */
export class Factory {
  private readonly underConstruction: Provider<unknown>[] = [];

  constructor(private readonly container: Container) {}

  construct<T>(provider: Provider<T>, token: Token<T>): T[] {
    if (Guards.isAsyncProvider(provider)) {
      throw new AsyncProvidersInSyncInjectionContextError(token);
    }

    try {
      if (this.underConstruction.includes(provider)) {
        const dependencyGraph = [...this.underConstruction, provider].map(getToken).map(toString);
        throw new CircularDependencyError(dependencyGraph);
      }

      this.underConstruction.push(provider);
      return this.doConstruct(provider);
    } finally {
      this.underConstruction.pop();
    }
  }

  async constructAsync<T>(provider: Provider<T>): Promise<T[]> {
    try {
      if (this.underConstruction.includes(provider)) {
        const dependencyGraph = [...this.underConstruction, provider].map(getToken).map(toString);
        throw new CircularDependencyError(dependencyGraph);
      }

      this.underConstruction.push(provider);

      if (Guards.isAsyncProvider(provider)) {
        return [await provider.useFactory(this.container)];
      }

      // in class and constructor providers, we allow stuff to be synchronously injected,
      // by just retrying when we encounter an async dependency down the road.
      // todo: this feels like an ugly workaround, so let's create something nice for this.
      if (Guards.isClassProvider(provider) || Guards.isConstructorProvider(provider)) {
        const create = Guards.isConstructorProvider(provider)
          ? () => [new provider()]
          : () => [new provider.useClass()];

        return retryOn(
          AsyncProvidersInSyncInjectionContextError,
          async () => create(),
          async (error) => {
            await this.container.getAsync(error.token, { multi: true, optional: true });
          },
        );
      }

      // all other types of providers are constructed synchronously anyway.
      return this.doConstruct(provider);
    } finally {
      this.underConstruction.pop();
    }
  }

  private doConstruct<T>(provider: SyncProvider<T>): T[] {
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
