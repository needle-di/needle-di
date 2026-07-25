import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { bootstrap, bootstrapAsync, Container } from "./container.ts";
import { injectable } from "./decorators.ts";
import { InjectionToken } from "./tokens.ts";
import { inject, injectAsync } from "./context.ts";
import { defineProviders } from "./providers.ts";

const myServiceConstructorSpy = vi.fn();

@injectable()
class MyService {
  constructor(public name = "MyService") {
    myServiceConstructorSpy();
  }
}

describe("Container API", () => {
  afterEach(() => {
    myServiceConstructorSpy.mockReset();
  });

  it("inject", () => {
    expect(() => inject(MyService)).toThrowError(
      "You can only invoke inject() or injectAsync() within an injection context",
    );

    const container = new Container();
    const token = new InjectionToken<MyService>("some-token");

    expect(() => container.get(token)).toThrowError("No provider(s) found");

    container.bind({
      provide: token,
      useFactory: () => inject(MyService),
    });

    expect(container.get(token)).toBeInstanceOf(MyService);
  });

  it("injectAsync", async () => {
    await expect(injectAsync(MyService)).rejects.toThrowError(
      "You can only invoke inject() or injectAsync() within an injection context",
    );

    const container = new Container();
    const token = new InjectionToken<string>("some-token");
    const otherToken = new InjectionToken<string>("other-token");
    const aliasToken = new InjectionToken<string>("alias-token");

    container
      .bind({
        provide: otherToken,
        async: true,
        useFactory: () => Promise.resolve("foo"),
      })
      .bind({
        provide: token,
        async: true,
        useFactory: () => injectAsync(otherToken),
      })
      .bind({
        provide: aliasToken,
        useExisting: token,
      });

    expect(await container.getAsync(token)).toBe("foo");
    expect(await container.getAsync(aliasToken)).toBe("foo");
  });

  it("has", async () => {
    const container = new Container();
    const childContainer = container.createChild();
    const token = new InjectionToken<MyService>("some-token");

    expect(container.has(token)).toBe(false);
    expect(childContainer.has(token)).toBe(false);

    container.bind({ provide: token, useClass: MyService });
    expect(container.has(token)).toBe(true);
    expect(childContainer.has(token)).toBe(true);

    // has shall not create a provider, even if it is async
    const asyncToken = new InjectionToken<MyService>("some-async-token");
    expect(container.has(asyncToken)).toBe(false);
    const spy = vi.fn();
    container.bind({
      provide: asyncToken,
      async: true,
      useFactory: async () => {
        spy();
        return new MyService();
      },
    });
    expect(container.has(asyncToken)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(0);
    await container.getAsync(asyncToken);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("bootstrap", () => {
    expect(bootstrap(MyService)).toBeInstanceOf(MyService);
    expect(bootstrap(MyService)).toBeInstanceOf(MyService);

    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(2);
  });

  it("bootstrapAsync", async () => {
    expect(await bootstrapAsync(MyService)).toBeInstanceOf(MyService);
    expect(await bootstrapAsync(MyService)).toBeInstanceOf(MyService);

    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(2);
  });

  describe("contexts", () => {
    it("should support nesting without interference", () => {
      const container1 = new Container().bind({ provide: "a", useFactory: () => "A" });
      const container2 = new Container().bind({ provide: "b", useFactory: () => container1.get("a") });

      const container3 = new Container()
        .bind({ provide: "c", useFactory: () => container2.get("b") })
        .bind({ provide: "d", useFactory: () => inject("c") })
        .bind({ provide: "e", useFactory: () => inject("b") });

      expect(container3.get("c")).toEqual("A");
      expect(container3.get("d")).toEqual("A");

      expect(() => container3.get("e")).toThrowError("No provider(s) found for b");
      expect(() => container3.get("b")).toThrowError("No provider(s) found for b");
    });

    it("should do array nested binding on bindAll", () => {
      const container = new Container().bindAll(
        { provide: "c", useValue: "cValue" },
        [{ provide: "d", useValue: "dValue" }],
        [defineProviders([{ provide: "e", useValue: "eValue" }])],
      );

      expect(container.get("c")).toEqual("cValue");
      expect(container.get("d")).toEqual("dValue");
      expect(container.get("e")).toEqual("eValue");
    });

    // https://github.com/needle-di/needle-di/issues/103
    it("should not leak the injection context of a suspended async construction", async () => {
      const tokenA = new InjectionToken<string>("A");
      const tokenB = new InjectionToken<string>("B");
      const tokenT = new InjectionToken<{ a: string; b: string }>("T");
      const tokenT2 = new InjectionToken<{ a: string; b: string }>("T2");

      let releaseA!: () => void;
      const aGate = new Promise<void>((resolve) => (releaseA = resolve));

      const parent = new Container();
      parent.bind({
        provide: tokenA,
        async: true,
        useFactory: async () => {
          await aGate; // suspend: the parent's injection context must not stay active meanwhile
          return "a-from-parent";
        },
      });
      parent.bind({ provide: tokenB, useValue: "b-from-parent" });

      const child = parent.createChild();
      child.bind({ provide: tokenB, useValue: "b-from-child" });
      child.bind({
        provide: tokenT, // bound on the child: its injections should resolve child-first
        async: true,
        useFactory: async () => {
          const aPromise = injectAsync(tokenA); // descends into the parent and suspends there
          const bPromise = injectAsync(tokenB); // must not read a leaked parent context
          return { a: await aPromise, b: await bPromise };
        },
      });
      child.bind({
        provide: tokenT2, // control case: identical, but B injected before A
        async: true,
        useFactory: async () => {
          const bPromise = injectAsync(tokenB);
          const aPromise = injectAsync(tokenA);
          return { a: await aPromise, b: await bPromise };
        },
      });

      const tPending = child.getAsync(tokenT);
      releaseA();

      expect(await tPending).toEqual({ a: "a-from-parent", b: "b-from-child" });
      expect(await child.getAsync(tokenT2)).toEqual({ a: "a-from-parent", b: "b-from-child" });
    });

    // https://github.com/needle-di/needle-di/issues/103
    it("should not allow inject() outside an injection context while an async construction is suspended", async () => {
      const token = new InjectionToken<string>("suspended");

      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));

      const container = new Container();
      container.bind({ provide: "value", useValue: "some-value" });
      container.bind({
        provide: token,
        async: true,
        useFactory: async () => {
          await gate;
          return "done";
        },
      });

      const pending = container.getAsync(token);

      // While the construction above is suspended, unrelated code must still be
      // outside any injection context.
      expect(() => inject("value")).toThrowError(
        "You can only invoke inject() or injectAsync() within an injection context",
      );

      release();
      await expect(pending).resolves.toBe("done");
    });
  });

  describe("concurrent async constructions", () => {
    // https://github.com/needle-di/needle-di/issues/102
    it("should not report a phantom circular dependency when a failed construction is retried while another is in flight", async () => {
      const tokenA = new InjectionToken<string>("A");
      const tokenB = new InjectionToken<string>("B");

      let aAttempts = 0;
      let releaseB!: () => void;
      const bGate = new Promise<void>((resolve) => (releaseB = resolve));

      const container = new Container();
      container.bind({
        provide: tokenA,
        async: true,
        useFactory: async () => {
          aAttempts += 1;
          if (aAttempts === 1) {
            await Promise.resolve(); // yield so B's construction can start before A fails
            throw new Error("transient failure");
          }
          return "a-value";
        },
      });
      container.bind({
        provide: tokenB,
        async: true,
        useFactory: async () => {
          await bGate; // keep B's construction in flight
          return "b-value";
        },
      });

      // A starts, then B starts; A then fails while B is still under construction.
      const aFirst = container.getAsync(tokenA).catch((error: Error) => error);
      const bPending = container.getAsync(tokenB);
      const aFirstResult = await aFirst;
      expect(aFirstResult).toBeInstanceOf(Error);
      expect((aFirstResult as Error).message).toBe("transient failure");

      // Retrying A while B is still in flight must not throw a circular dependency error:
      // A has no dependencies at all.
      await expect(container.getAsync(tokenA)).resolves.toBe("a-value");

      releaseB();
      await expect(bPending).resolves.toBe("b-value");
    });

    it("should still detect real circular dependencies in async constructions", async () => {
      const tokenA = new InjectionToken<string>("A");
      const tokenB = new InjectionToken<string>("B");

      const container = new Container();
      container.bind({
        provide: tokenA,
        async: true,
        useFactory: async () => `a(${await injectAsync(tokenB)})`,
      });
      container.bind({
        provide: tokenB,
        async: true,
        useFactory: async () => `b(${await injectAsync(tokenA)})`,
      });

      await expect(container.getAsync(tokenA)).rejects.toThrowError(/circular dependency/i);
    });

    // https://github.com/needle-di/needle-di/issues/113
    // The tests below generalize https://github.com/needle-di/needle-di/issues/102.
    // That issue was reported as an unwinding problem: `constructAsync`'s `finally { pop() }`
    // removed another construction's entry when concurrent constructions settled out of LIFO
    // order, stranding entries on the shared `underConstruction` stack. The narrower fix made
    // each construction remove its own entry by identity, but kept the stack container-wide.
    // Nothing has to go wrong with unwinding, though: while a construction is suspended its
    // entries are simply visible to every other resolution, so any two overlapping resolutions
    // collide on whatever they have in common. Tracking is now per resolution instead.
    it("should not report a circular dependency for independent resolutions sharing a token", async () => {
      const shared = new InjectionToken<string>("SHARED");
      const tokenA = new InjectionToken<string>("A");
      const tokenB = new InjectionToken<string>("B");

      const sharedSpy = vi.fn();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));

      const container = new Container();
      container.bind({
        provide: shared,
        async: true,
        useFactory: async () => {
          sharedSpy();
          await gate; // keeps both resolutions overlapping
          return "shared";
        },
      });
      container.bind({ provide: tokenA, async: true, useFactory: async () => `A(${await injectAsync(shared)})` });
      container.bind({ provide: tokenB, async: true, useFactory: async () => `B(${await injectAsync(shared)})` });

      const pending = Promise.all([container.getAsync(tokenA), container.getAsync(tokenB)]);
      release();

      await expect(pending).resolves.toEqual(["A(shared)", "B(shared)"]);
      expect(sharedSpy).toHaveBeenCalledTimes(1);
    });

    it("should share a single construction between concurrent requests for the same token", async () => {
      const token = new InjectionToken<MyService>("SHARED");

      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));

      const container = new Container();
      container.bind({
        provide: token,
        async: true,
        useFactory: async () => {
          await gate;
          return new MyService();
        },
      });

      const pending = Promise.all([container.getAsync(token), container.getAsync(token)]);
      release();

      const [first, second] = await pending;
      expect(first).toBeInstanceOf(MyService);
      expect(first).toBe(second);
      expect(myServiceConstructorSpy).toHaveBeenCalledTimes(1);
    });

    it("should not report a circular dependency for concurrent resolutions through an alias", async () => {
      const target = new InjectionToken<string>("TARGET");
      const alias = new InjectionToken<string>("ALIAS");

      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));

      const container = new Container();
      container.bind({
        provide: target,
        async: true,
        useFactory: async () => {
          await gate;
          return "value";
        },
      });
      container.bind({ provide: alias, useExisting: target });

      const pending = Promise.all([container.getAsync(alias), container.getAsync(alias)]);
      release();

      await expect(pending).resolves.toEqual(["value", "value"]);
    });

    it("should not report a circular dependency for sibling containers sharing a parent's token", async () => {
      // NOTE: no token-level factory here, otherwise `autoBindIfNeeded` would bind a
      // separate provider on each child and the parent would never be consulted.
      const shared = new InjectionToken<string>("SHARED");
      const tokenA = new InjectionToken<string>("A");
      const tokenB = new InjectionToken<string>("B");

      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));

      const parent = new Container();
      parent.bind({
        provide: shared,
        async: true,
        useFactory: async () => {
          await gate;
          return "shared";
        },
      });

      const child1 = parent.createChild();
      child1.bind({ provide: tokenA, async: true, useFactory: async () => `A(${await injectAsync(shared)})` });
      const child2 = parent.createChild();
      child2.bind({ provide: tokenB, async: true, useFactory: async () => `B(${await injectAsync(shared)})` });

      const pending = Promise.all([child1.getAsync(tokenA), child2.getAsync(tokenB)]);
      release();

      await expect(pending).resolves.toEqual(["A(shared)", "B(shared)"]);
    });

    it("should not report a circular dependency for a sync resolution while an async one is suspended", async () => {
      const target = new InjectionToken<string>("TARGET");
      const alias = new InjectionToken<string>("ALIAS");

      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));

      const container = new Container();
      container.bind({
        provide: target,
        async: true,
        useFactory: async () => {
          await gate;
          return "value";
        },
      });
      container.bind({ provide: alias, useExisting: target });

      const pending = container.getAsync(alias);

      // The alias is mid-flight on another resolution. Resolving it synchronously must
      // complain about the async provider, not about a circular dependency.
      expect(() => container.get(alias)).toThrowError(/are async, please use injectAsync/);

      release();
      await expect(pending).resolves.toBe("value");
    });

    it("should not report a circular dependency for auto-bound token factories", async () => {
      const shared = new InjectionToken<string>("SHARED", {
        async: true,
        factory: async () => {
          await delay(10);
          return "shared";
        },
      });
      const tokenA = new InjectionToken<string>("A", {
        async: true,
        factory: async () => `A(${await injectAsync(shared)})`,
      });
      const tokenB = new InjectionToken<string>("B", {
        async: true,
        factory: async () => `B(${await injectAsync(shared)})`,
      });

      const container = new Container();

      await expect(Promise.all([container.getAsync(tokenA), container.getAsync(tokenB)])).resolves.toEqual([
        "A(shared)",
        "B(shared)",
      ]);
    });

    it("should keep many overlapping resolutions of a shared diamond consistent", async () => {
      const leaf = new InjectionToken<{ id: number }>("LEAF");
      const left = new InjectionToken<string>("LEFT");
      const right = new InjectionToken<string>("RIGHT");
      const root = new InjectionToken<string>("ROOT");

      let leafCount = 0;
      const container = new Container();
      container.bind({
        provide: leaf,
        async: true,
        useFactory: async () => {
          await delay(Math.random() * 5);
          return { id: ++leafCount };
        },
      });
      container.bind({
        provide: left,
        async: true,
        useFactory: async () => {
          const dep = injectAsync(leaf);
          await delay(Math.random() * 5);
          return `left(${(await dep).id})`;
        },
      });
      container.bind({
        provide: right,
        async: true,
        useFactory: async () => {
          const dep = injectAsync(leaf);
          await delay(Math.random() * 5);
          return `right(${(await dep).id})`;
        },
      });
      container.bind({
        provide: root,
        async: true,
        useFactory: async () => {
          const [l, r] = [injectAsync(left), injectAsync(right)];
          return `${await l}+${await r}`;
        },
      });

      const results = await Promise.all(
        Array.from({ length: 50 }, () =>
          Promise.all([container.getAsync(root), container.getAsync(left), container.getAsync(right)]),
        ),
      );

      expect(leafCount).toBe(1);
      results.forEach((result) => expect(result).toEqual(["left(1)+right(1)", "left(1)", "right(1)"]));
    });

    it("should not cache a failed async construction", async () => {
      const token = new InjectionToken<string>("FLAKY");

      let attempts = 0;
      const container = new Container();
      container.bind({
        provide: token,
        async: true,
        useFactory: async () => {
          attempts += 1;
          await delay(1);
          if (attempts < 3) {
            throw new Error(`boom ${attempts}`);
          }
          return "ok";
        },
      });

      await expect(Promise.all([container.getAsync(token), container.getAsync(token)])).rejects.toThrowError("boom 1");
      expect(attempts).toBe(1); // both callers joined the same attempt

      await expect(container.getAsync(token)).rejects.toThrowError("boom 2");
      await expect(container.getAsync(token)).resolves.toBe("ok");
    });
  });

  describe("circular dependencies", () => {
    it("should report an accurate path for a sync cycle between factory providers", () => {
      const tokenA = new InjectionToken<string>("A");
      const tokenB = new InjectionToken<string>("B");

      const container = new Container();
      container.bind({ provide: tokenA, useFactory: () => `a(${inject(tokenB)})` });
      container.bind({ provide: tokenB, useFactory: () => `b(${inject(tokenA)})` });

      expect(() => container.get(tokenA)).toThrowError(
        'Detected circular dependency: InjectionToken "A" -> InjectionToken "B" -> InjectionToken "A".',
      );
    });

    it("should report an accurate path for an async cycle between factory providers", async () => {
      const tokenA = new InjectionToken<string>("A");
      const tokenB = new InjectionToken<string>("B");
      const tokenC = new InjectionToken<string>("C");

      const container = new Container();
      container.bind({ provide: tokenA, async: true, useFactory: async () => `a(${await injectAsync(tokenB)})` });
      container.bind({ provide: tokenB, async: true, useFactory: async () => `b(${await injectAsync(tokenC)})` });
      container.bind({ provide: tokenC, async: true, useFactory: async () => `c(${await injectAsync(tokenA)})` });

      await expect(container.getAsync(tokenA)).rejects.toThrowError(
        'Detected circular dependency: InjectionToken "A" -> InjectionToken "B" -> InjectionToken "C" -> InjectionToken "A".',
      );
    });

    it("should report an accurate path for a self-referencing provider", async () => {
      const token = new InjectionToken<string>("SELF");

      const syncContainer = new Container();
      syncContainer.bind({ provide: token, useFactory: () => `self(${inject(token)})` });
      expect(() => syncContainer.get(token)).toThrowError(
        'Detected circular dependency: InjectionToken "SELF" -> InjectionToken "SELF".',
      );

      const asyncContainer = new Container();
      asyncContainer.bind({ provide: token, async: true, useFactory: async () => `self(${await injectAsync(token)})` });
      await expect(asyncContainer.getAsync(token)).rejects.toThrowError(
        'Detected circular dependency: InjectionToken "SELF" -> InjectionToken "SELF".',
      );
    });

    it("should detect a cycle between class providers, both sync and async", async () => {
      class Foo {
        bar: unknown = inject(Bar);
      }
      class Bar {
        foo: unknown = inject(Foo);
      }

      const bindings = (container: Container) =>
        container.bind({ provide: Foo, useClass: Foo }).bind({ provide: Bar, useClass: Bar });

      expect(() => bindings(new Container()).get(Foo)).toThrowError("Detected circular dependency: Foo -> Bar -> Foo.");
      await expect(bindings(new Container()).getAsync(Foo)).rejects.toThrowError(
        "Detected circular dependency: Foo -> Bar -> Foo.",
      );
    });

    it("should detect a cycle that runs through an async dependency of a class provider", async () => {
      const token = new InjectionToken<string>("ASYNC");

      class Widget {
        value = inject(token);
      }

      const container = new Container();
      container.bind({ provide: Widget, useClass: Widget });
      container.bind({
        provide: token,
        async: true,
        useFactory: async () => `async(${(await injectAsync(Widget)).value})`,
      });

      await expect(container.getAsync(Widget)).rejects.toThrowError(
        'Detected circular dependency: Widget -> InjectionToken "ASYNC" -> Widget.',
      );
    });

    it("should report the full path of a cycle reached through a parent container", () => {
      const parentA = new InjectionToken<string>("PARENT_A");
      const parentB = new InjectionToken<string>("PARENT_B");
      const childToken = new InjectionToken<string>("CHILD");

      const parent = new Container();
      parent.bind({ provide: parentA, useFactory: () => `a(${inject(parentB)})` });
      parent.bind({ provide: parentB, useFactory: () => `b(${inject(parentA)})` });

      const child = parent.createChild();
      child.bind({ provide: childToken, useFactory: () => `c(${inject(parentA)})` });

      // The chain must survive the hop into the parent, so that the segment resolved on
      // the child is part of the reported path.
      expect(() => child.get(childToken)).toThrowError(
        'Detected circular dependency: InjectionToken "CHILD" -> InjectionToken "PARENT_A" ' +
          '-> InjectionToken "PARENT_B" -> InjectionToken "PARENT_A".',
      );
    });

    it("should not report a cycle when a token is injected twice on separate branches", () => {
      const leaf = new InjectionToken<string>("LEAF");
      const left = new InjectionToken<string>("LEFT");
      const right = new InjectionToken<string>("RIGHT");
      const root = new InjectionToken<string>("ROOT");

      const container = new Container();
      container.bind({ provide: leaf, useFactory: () => "leaf" });
      container.bind({ provide: left, useFactory: () => `left(${inject(leaf)})` });
      container.bind({ provide: right, useFactory: () => `right(${inject(leaf)})` });
      container.bind({ provide: root, useFactory: () => `${inject(left)}+${inject(right)}` });

      expect(container.get(root)).toBe("left(leaf)+right(leaf)");
    });
  });

  it("should unbind a single service", () => {
    const container = new Container();

    container.bind({ provide: MyService, useClass: MyService });

    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(0);

    const myService1 = container.get(MyService);
    const myService2 = container.get(MyService);

    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(1);
    expect(myService1).toBe(myService2);

    container.unbind(MyService);

    const myService3 = container.get(MyService);

    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(2);
    expect(myService3).not.toBe(myService1);
    expect(myService3).not.toBe(myService2);
  });
});
