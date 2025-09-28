import { afterEach, describe, expect, it, vi } from "vitest";

import { bootstrap, bootstrapAsync, Container } from "./container.ts";
import { injectable } from "./decorators.ts";
import { InjectionToken } from "./tokens.ts";
import { inject, injectAsync } from "./context.ts";

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
  });
});
