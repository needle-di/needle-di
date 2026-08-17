/**
 * A scope describes how widely an instance is shared, by deciding which container an
 * auto-bound provider is registered on. Since a provider is always resolved by the
 * container that owns it, it also decides which container the dependencies of that
 * service are resolved against.
 *
 * Scopes only apply to auto-binding, so to classes annotated with `@injectable()` and to
 * injection tokens that carry a factory. Providers that you bind yourself live on the
 * container you bind them on.
 *
 * {@link https://needle-di.io/advanced/scopes.html}
 */
export const Scope = {
  /**
   * Auto-bind on the root container, so the whole container tree shares a single
   * instance, no matter which container requested it first. This is the default.
   */
  ROOT: "root",

  /**
   * Auto-bind on the container that requests it, so every container constructs its own
   * instance, and that instance sees the bindings of the container it belongs to.
   */
  CONTAINER: "container",
} as const;

/**
 * The scope of an auto-bound service. Also available as string literals,
 * so `Scope.CONTAINER` and `"container"` are interchangeable.
 */
export type Scope = (typeof Scope)[keyof typeof Scope];

/**
 * The scope that applies when a service does not declare one.
 *
 * @internal
 */
export const DEFAULT_SCOPE: Scope = Scope.ROOT;
