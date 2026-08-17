import { afterEach, describe, expect, it, vi } from "vitest";

import { Container } from "./container.ts";
import { inject } from "./context.ts";
import { injectable } from "./decorators.ts";
import { Scope } from "./scopes.ts";
import { InjectionToken } from "./tokens.ts";

const CONFIG = new InjectionToken<string>("CONFIG");

const rootScopedSpy = vi.fn();
const containerScopedSpy = vi.fn();

@injectable()
class RootScopedService {
  public readonly config = inject(CONFIG, { optional: true });

  constructor() {
    rootScopedSpy();
  }
}

@injectable({ scope: Scope.CONTAINER })
class ContainerScopedService {
  public readonly config = inject(CONFIG, { optional: true });

  constructor() {
    containerScopedSpy();
  }
}

describe("Scopes", () => {
  afterEach(() => {
    rootScopedSpy.mockReset();
    containerScopedSpy.mockReset();
  });

  describe("Scope.ROOT (default)", () => {
    it("should construct an annotated class once for the whole container tree", () => {
      const parent = new Container();
      const child = parent.createChild();
      const grandChild = child.createChild();

      expect(parent.get(RootScopedService)).toBe(child.get(RootScopedService));
      expect(child.get(RootScopedService)).toBe(grandChild.get(RootScopedService));
      expect(rootScopedSpy).toHaveBeenCalledOnce();
    });

    it("should not depend on which container requested it first", () => {
      const parent = new Container();
      const child = parent.createChild();

      const fromChild = child.get(RootScopedService);
      const fromParent = parent.get(RootScopedService);

      expect(fromChild).toBe(fromParent);
      expect(rootScopedSpy).toHaveBeenCalledOnce();
    });

    it("should share a single instance between sibling containers", () => {
      const parent = new Container();

      expect(parent.createChild().get(RootScopedService)).toBe(parent.createChild().get(RootScopedService));
      expect(rootScopedSpy).toHaveBeenCalledOnce();
    });

    // See https://github.com/needle-di/needle-di/issues/110
    it("should invoke the factory of an injection token once for the whole container tree", () => {
      const factory = vi.fn(() => 3);
      const token = new InjectionToken("counter", { factory });

      const container = new Container();

      expect(container.get(token)).toBe(3);
      expect(container.createChild().get(token)).toBe(3);
      expect(factory).toHaveBeenCalledOnce();
    });

    it("should invoke an async factory once for the whole container tree", async () => {
      const factory = vi.fn(async () => 3);
      const token = new InjectionToken("counter", { async: true, factory });

      const container = new Container();

      expect(await container.getAsync(token)).toBe(3);
      expect(await container.createChild().getAsync(token)).toBe(3);
      expect(factory).toHaveBeenCalledOnce();
    });

    it("should resolve its own dependencies against the root container", () => {
      const parent = new Container();
      const child = parent.createChild();

      parent.bind({ provide: CONFIG, useValue: "parent" });
      child.bind({ provide: CONFIG, useValue: "child" });

      expect(child.get(RootScopedService).config).toBe("parent");
    });
  });

  describe("Scope.CONTAINER", () => {
    it("should construct an annotated class once per container", () => {
      const parent = new Container();
      const child = parent.createChild();

      expect(parent.get(ContainerScopedService)).not.toBe(child.get(ContainerScopedService));
      expect(containerScopedSpy).toHaveBeenCalledTimes(2);
    });

    it("should reuse its own instance within the same container", () => {
      const container = new Container();

      expect(container.get(ContainerScopedService)).toBe(container.get(ContainerScopedService));
      expect(containerScopedSpy).toHaveBeenCalledOnce();
    });

    it("should give sibling containers their own instance", () => {
      const parent = new Container();

      expect(parent.createChild().get(ContainerScopedService)).not.toBe(
        parent.createChild().get(ContainerScopedService),
      );
      expect(containerScopedSpy).toHaveBeenCalledTimes(2);
    });

    it("should resolve its own dependencies against the container that requested it", () => {
      const parent = new Container();
      const child = parent.createChild();

      parent.bind({ provide: CONFIG, useValue: "parent" });
      child.bind({ provide: CONFIG, useValue: "child" });

      expect(parent.get(ContainerScopedService).config).toBe("parent");
      expect(child.get(ContainerScopedService).config).toBe("child");
    });

    it("should invoke the factory of an injection token once per container", () => {
      const factory = vi.fn(() => 3);
      const token = new InjectionToken("counter", { scope: Scope.CONTAINER, factory });

      const parent = new Container();

      expect(parent.get(token)).toBe(3);
      expect(parent.createChild().get(token)).toBe(3);
      expect(factory).toHaveBeenCalledTimes(2);
    });

    it("should invoke an async factory once per container", async () => {
      const factory = vi.fn(async () => 3);
      const token = new InjectionToken("counter", { async: true, scope: Scope.CONTAINER, factory });

      const parent = new Container();

      expect(await parent.getAsync(token)).toBe(3);
      expect(await parent.createChild().getAsync(token)).toBe(3);
      expect(factory).toHaveBeenCalledTimes(2);
    });

    it("should accept the scope as a plain string", () => {
      const factory = vi.fn(() => 3);
      const token = new InjectionToken("counter", { scope: "container", factory });

      const parent = new Container();

      parent.get(token);
      parent.createChild().get(token);

      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  describe("Explicit bindings", () => {
    it("should let a child override an auto-bound service", () => {
      const parent = new Container();
      const child = parent.createChild();

      child.bind({ provide: RootScopedService, useValue: { config: "explicit" } });

      expect(child.get(RootScopedService).config).toBe("explicit");
      expect(rootScopedSpy).not.toHaveBeenCalled();
    });

    it("should not let auto-binding on a child shadow an explicit binding on its parent", () => {
      const parent = new Container();
      const child = parent.createChild();

      parent.bind({ provide: RootScopedService, useValue: { config: "explicit" } });

      expect(child.get(RootScopedService).config).toBe("explicit");
      expect(rootScopedSpy).not.toHaveBeenCalled();
    });

    it("should not let a container-scoped class shadow an explicit binding on its parent", () => {
      const parent = new Container();
      const child = parent.createChild();

      parent.bind({ provide: ContainerScopedService, useValue: { config: "explicit" } });

      expect(child.get(ContainerScopedService).config).toBe("explicit");
      expect(containerScopedSpy).not.toHaveBeenCalled();
    });

    it("should auto-bind again after the auto-bound provider was unbound", () => {
      const container = new Container();

      container.get(RootScopedService);
      container.unbind(RootScopedService);
      container.get(RootScopedService);

      expect(rootScopedSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Inheritance", () => {
    it("should not inherit the scope of a parent class", () => {
      @injectable({ scope: Scope.CONTAINER })
      class Base {
        public readonly name: string = "base";
      }

      @injectable()
      class Sub extends Base {
        public override readonly name = "sub";
      }

      const parent = new Container();
      const child = parent.createChild();

      expect(parent.get(Sub)).toBe(child.get(Sub));
    });

    it("should apply the scope when a class is requested by its parent class", () => {
      abstract class Base {
        abstract name: string;
      }

      @injectable({ scope: Scope.CONTAINER })
      class Sub extends Base {
        name = "sub";
      }

      const parent = new Container();
      const child = parent.createChild();

      expect(parent.get(Base)).toBeInstanceOf(Sub);
      expect(parent.get(Base)).not.toBe(child.get(Base));
    });

    it("should keep multi-injection intact when all classes share a scope", () => {
      abstract class Base {
        abstract name: string;
      }

      @injectable({ scope: Scope.CONTAINER })
      class Foo extends Base {
        name = "foo";
      }

      @injectable({ scope: Scope.CONTAINER })
      class Bar extends Base {
        name = "bar";
      }

      const child = new Container().createChild();

      expect(child.get(Base, { multi: true }).map((it) => it.name)).toEqual(["foo", "bar"]);
      expect(child.get(Base, { multi: true })[0]).toBeInstanceOf(Foo);
      expect(child.get(Base, { multi: true })[1]).toBeInstanceOf(Bar);
    });

    it("should reject a token that resolves to classes with different scopes", () => {
      abstract class Base {
        abstract name: string;
      }

      @injectable()
      class Foo extends Base {
        name = "foo";
      }

      @injectable({ scope: Scope.CONTAINER })
      class Bar extends Base {
        name = "bar";
      }

      const container = new Container();

      expect(() => container.get(Base, { multi: true })).toThrowError(
        "Cannot auto-bind Base, since the classes it resolves to declare different scopes: " +
          "Foo (root), Bar (container). Give them the same scope, or bind them explicitly.",
      );

      // requesting them individually is unambiguous, so it still works
      expect(container.get(Foo)).toBeInstanceOf(Foo);
      expect(container.get(Bar)).toBeInstanceOf(Bar);
    });
  });
});
