/* eslint-disable @typescript-eslint/no-unused-vars,@typescript-eslint/ban-ts-comment */
// noinspection JSUnusedLocalSymbols

import { describe, it } from "vitest";

import {
  defineProviders,
  type AsyncFactoryProvider,
  type ClassProvider,
  type ConstructorProvider,
  type ExistingProvider,
  type FactoryProvider,
  type Provider,
  type ValueProvider,
} from "./providers.ts";
import { InjectionToken } from "./tokens.ts";
import { Container } from "./container.ts";
import { inject, injectAsync } from "./context.ts";

describe("Type-safety", () => {
  class FooService {
    private x = Math.random();
  }

  class FooChildService extends FooService {
    private y = Math.random();
  }

  class OtherService {
    private z = Math.random();
  }

  describe("Providers API", () => {
    it("constructor provider", () => {
      const a: ConstructorProvider<FooService> = FooService;
      const b: ConstructorProvider<FooService> = FooChildService;

      // @ts-expect-error
      const c: ConstructorProvider<FooService> = OtherService;
      // @ts-expect-error
      const d: ConstructorProvider<FooService> = 3;
    });

    it("class provider", () => {
      const a: ClassProvider<FooService> = { provide: FooService, useClass: FooService };
      const b: ClassProvider<FooService> = { provide: FooService, useClass: FooChildService };

      // @ts-expect-error
      const c: ClassProvider<FooService> = { provide: FooService, useClass: OtherService };
      // @ts-expect-error
      const d: ClassProvider<FooChildService> = { provide: FooChildService, useClass: FooService };
      // @ts-expect-error
      const e: ClassProvider<FooService> = { provide: FooService, useClass: 3 };
      // @ts-expect-error
      const f: ClassProvider<FooService> = { provide: 3, useClass: 3 };
      // @ts-expect-error
      const g: ClassProvider<string> = { provide: String, useClass: String };
    });

    it("value provider", () => {
      const a: ValueProvider<FooService> = { provide: FooService, useValue: new FooService() };
      const b: ValueProvider<FooService> = { provide: FooService, useValue: new FooChildService() };

      // @ts-expect-error
      const c: ValueProvider<FooService> = { provide: FooService, useValue: new OtherService() };
      // @ts-expect-error
      const d: ValueProvider<FooChildService> = { provide: FooChildService, useValue: new FooService() };
      // @ts-expect-error
      const e: ValueProvider<FooService> = { provide: FooService, useValue: 3 };
      // @ts-expect-error
      const f: ValueProvider<FooService> = { provide: 3, useValue: 3 };
      // @ts-expect-error
      const g: ValueProvider<string> = { provide: String, useValue: "foo" };
    });

    it("factory provider", () => {
      const a: FactoryProvider<FooService> = { provide: FooService, useFactory: () => new FooService() };
      const b: FactoryProvider<FooService> = { provide: FooService, useFactory: () => new FooChildService() };

      // @ts-expect-error
      const a2: FactoryProvider<FooService> = { provide: FooService, useFactory: async () => new FooService() };
      // @ts-expect-error
      const b2: FactoryProvider<FooService> = { provide: FooService, useFactory: async () => new FooChildService() };

      // @ts-expect-error
      const c: FactoryProvider<FooService> = { provide: FooService, useFactory: () => new OtherService() };
      // @ts-expect-error
      const d: FactoryProvider<FooChildService> = { provide: FooChildService, useFactory: () => new FooService() };
      // @ts-expect-error
      const e: FactoryProvider<FooService> = { provide: FooService, useFactory: () => 3 };
      // @ts-expect-error
      const f: FactoryProvider<FooService> = { provide: 3, useFactory: () => 3 };
      // @ts-expect-error
      const g: FactoryProvider<string> = { provide: String, useFactory: () => "foo" };
    });

    it("async factory provider", () => {
      const a: AsyncFactoryProvider<FooService> = {
        provide: FooService,
        async: true,
        useFactory: async () => new FooService(),
      };
      const b: AsyncFactoryProvider<FooService> = {
        provide: FooService,
        async: true,
        useFactory: async () => new FooChildService(),
      };

      const a2: AsyncFactoryProvider<FooService> = {
        provide: FooService,
        async: true,
        // @ts-expect-error
        useFactory: () => new FooService(),
      };
      const b2: AsyncFactoryProvider<FooService> = {
        provide: FooService,
        async: true,
        // @ts-expect-error
        useFactory: () => new FooChildService(),
      };

      const c: AsyncFactoryProvider<FooService> = {
        provide: FooService,
        async: true,
        // @ts-expect-error
        useFactory: async () => new OtherService(),
      };
      const d: AsyncFactoryProvider<FooChildService> = {
        provide: FooChildService,
        async: true,
        // @ts-expect-error
        useFactory: async () => new FooService(),
      };
      // @ts-expect-error
      const e: AsyncFactoryProvider<FooService> = { provide: FooService, async: true, useFactory: async () => 3 };
      // @ts-expect-error
      const f: AsyncFactoryProvider<FooService> = { provide: 3, async: true, useFactory: async () => 3 };
      // @ts-expect-error
      const g: AsyncFactoryProvider<string> = { provide: String, async: true, useFactory: async () => "foo" };
    });

    it("existing factory provider", () => {
      const a: ExistingProvider<FooService> = { provide: FooService, useExisting: FooService };
      const b: ExistingProvider<FooService> = { provide: FooService, useExisting: FooChildService };

      const token1 = new InjectionToken<FooService>("token1");
      const token2 = new InjectionToken<FooChildService>("token2");
      const token3 = new InjectionToken<OtherService>("token3");

      const a2: ExistingProvider<FooService> = { provide: FooService, useExisting: token1 };
      const b2: ExistingProvider<FooService> = { provide: FooService, useExisting: token2 };
      const b3: ExistingProvider<FooService> = { provide: FooService, useExisting: "unknown" };

      // @ts-expect-error
      const c: ExistingProvider<FooService> = { provide: FooService, useExisting: OtherService };
      // @ts-expect-error
      const c2: ExistingProvider<FooService> = { provide: FooService, useExisting: token3 };
      // @ts-expect-error
      const d: ExistingProvider<FooChildService> = { provide: FooChildService, useExisting: FooService };
      // @ts-expect-error
      const e: ExistingProvider<FooService> = { provide: 3, useExisting: 3 };
    });

    it("defineProviders", () => {
      const TOKEN1 = new InjectionToken<string>("token1");
      const TOKEN2 = new InjectionToken<number>("token2");

      defineProviders(
        { provide: FooService, useClass: FooChildService },
        { provide: FooChildService, useClass: FooChildService },
      );

      // @ts-expect-error
      defineProviders({ provide: FooChildService, useClass: FooService });

      // @ts-expect-error
      defineProviders({ provide: TOKEN1, useValue: 42 });
      // @ts-expect-error
      defineProviders({ provide: TOKEN2, useValue: "Foo" });

      // 2 params
      defineProviders({ provide: TOKEN1, useValue: "Foo" }, { provide: TOKEN2, useValue: 42 });
      defineProviders([
        { provide: TOKEN1, useValue: "Foo" },
        { provide: TOKEN2, useValue: 42 },
      ]);
      defineProviders(
        { provide: TOKEN1, useValue: "Foo" },
        // @ts-expect-error
        { provide: TOKEN2, useValue: "Foo" },
      );

      // nesting test
      defineProviders({ provide: TOKEN1, useValue: "Foo" }, [
        { provide: TOKEN2, useValue: 42 },

        // @ts-expect-error
        123,

        [
          defineProviders([
            { provide: TOKEN1, useValue: "Foo" },
            { provide: TOKEN2, useValue: 42 },
          ]),
        ],
      ]);
    });
  });
  describe("Binding", () => {
    const TOKEN1 = new InjectionToken<string>("token1");
    const TOKEN2 = new InjectionToken<number>("token2");

    it("bind()", () => {
      const container = new Container();
      container.bind({ provide: FooService, useClass: FooChildService });
      container.bind({ provide: FooChildService, useClass: FooChildService });

      // @ts-expect-error
      container.bind({ provide: FooChildService, useClass: FooService });

      container.bind({ provide: TOKEN1, useValue: "Foo" });
      container.bind({ provide: TOKEN2, useValue: 42 });

      // @ts-expect-error
      container.bind({ provide: TOKEN1, useValue: 42 });
      // @ts-expect-error
      container.bind({ provide: TOKEN2, useValue: "Foo" });
    });

    it("bindAll()", () => {
      const container = new Container();
      container.bindAll({ provide: FooService, useClass: FooChildService }, [
        { provide: FooChildService, useClass: FooChildService },
      ]);

      container.bindAll(...[{ provide: FooChildService, useClass: FooChildService }]);

      // @ts-expect-error
      container.bindAll({ provide: FooChildService, useClass: FooService });

      const provderList = defineProviders({ provide: TOKEN1, useValue: "Foo" }, [
        { provide: TOKEN2, useValue: 42 },

        [
          [
            defineProviders([
              { provide: TOKEN1, useValue: "Foo" },
              { provide: TOKEN2, useValue: 42 },
            ]),
          ],
        ],
      ]);
      container.bindAll(provderList);
      container.bindAll(...provderList, [defineProviders(provderList)]);
    });
  });
  it("Injection tokens", () => {
    const UNKNOWN_TYPE = new InjectionToken("UNKNOWN_TYPE");
    const SOME_NUMBER = new InjectionToken<number>("SOME_NUMBER");
    const SOME_STRING = new InjectionToken<number>("SOME_STRING");
    const SOME_NUMBER_FACTORY = new InjectionToken<number>("SOME_NUMBER_FACTORY", {
      factory: () => 3,
    });
    const SOME_STRING_FACTORY = new InjectionToken<string>("SOME_STRING_FACTORY", {
      factory: () => "foo",
    });
    const NUMBER_INFERRED = new InjectionToken("NUMBER_INFERRED", {
      factory: () => 3,
    });
    const STRING_INFERRED = new InjectionToken("STRING_INFERRED", {
      factory: () => "foo",
    });

    const INVALID_NUMBER_FACTORY = new InjectionToken<number>("INVALID_NUMBER_FACTORY", {
      // @ts-expect-error
      factory: () => "invalid",
    });
    const INVALID_STRING_FACTORY = new InjectionToken<string>("INVALID_STRING_FACTORY", {
      // @ts-expect-error
      factory: () => 3,
    });

    const container = new Container();

    container.bind({ provide: NUMBER_INFERRED, useValue: 3 });
    // @ts-expect-error
    container.bind({ provide: NUMBER_INFERRED, useValue: "foo" });
    container.bind({ provide: STRING_INFERRED, useValue: "foo" });
    // @ts-expect-error
    container.bind({ provide: STRING_INFERRED, useValue: 3 });

    // type inference for injection tokens with factories
    const ASYNC_FACTORY = new InjectionToken("SOME_NUMBER_FACTORY", {
      async: true,
      factory: async () => 3,
    });
  });
  describe("Injecting", () => {
    class FooService {
      private x = 5;
    }

    class FooChildService extends FooService {
      private y = Math.random();
    }

    it("inject()", () => {
      class Foo {
        private a = inject(FooService) satisfies FooService;
        private b = inject(FooChildService) satisfies FooService;
        // @ts-expect-error
        private c = inject(FooService) satisfies FooChildService;
        // @ts-expect-error
        private d = inject(FooService) satisfies Promise<FooService>;
        // @ts-expect-error
        private e = inject(FooChildService) satisfies Promise<FooService>;
      }
    });

    it("injectAsync()", () => {
      class Foo {
        private a = injectAsync(FooService) satisfies Promise<FooService>;
        private b = injectAsync(FooChildService) satisfies Promise<FooService>;
        // @ts-expect-error
        private c = injectAsync(FooService) satisfies Promise<FooChildService>;
        // @ts-expect-error
        private d = injectAsync(FooService) satisfies FooService;
        // @ts-expect-error
        private e = injectAsync(FooChildService) satisfies FooService;
      }
    });

    it("inject() with multi", () => {
      class Foo {
        private a = inject(FooService, { multi: true }) satisfies FooService[];
        private b = inject(FooChildService, { multi: true }) satisfies FooService[];
        // @ts-expect-error
        private c = inject(FooService, { multi: true }) satisfies FooChildService[];
        // @ts-expect-error
        private d = inject(FooService, { multi: true }) satisfies Promise<FooService[]>;
        // @ts-expect-error
        private e = inject(FooChildService, { multi: true }) satisfies Promise<FooService[]>;
      }
    });

    it("injectAsync() with multi", () => {
      class Foo {
        private a = injectAsync(FooService, { multi: true }) satisfies Promise<FooService[]>;
        private b = injectAsync(FooChildService, { multi: true }) satisfies Promise<FooService[]>;
        // @ts-expect-error
        private c = injectAsync(FooService, { multi: true }) satisfies Promise<FooChildService[]>;
        // @ts-expect-error
        private d = injectAsync(FooService, { multi: true }) satisfies FooService[];
        // @ts-expect-error
        private e = injectAsync(FooChildService, { multi: true }) satisfies FooService[];
      }
    });

    it("inject() with optional", () => {
      class Foo {
        private a = inject(FooService, { optional: true }) satisfies FooService | undefined;
        private b = inject(FooChildService, { optional: true }) satisfies FooService | undefined;
        // @ts-expect-error
        private c = inject(FooService, { optional: true }) satisfies FooChildService | undefined;
        // @ts-expect-error
        private d = inject(FooService, { optional: true }) satisfies Promise<FooService | undefined>;
        // @ts-expect-error
        private e = inject(FooChildService, { optional: true }) satisfies Promise<FooService | undefined>;
      }
    });

    it("injectAsync() with optional", () => {
      class Foo {
        private a = injectAsync(FooService, { optional: true }) satisfies Promise<FooService | undefined>;
        private b = injectAsync(FooChildService, { optional: true }) satisfies Promise<FooService | undefined>;
        // @ts-expect-error
        private c = injectAsync(FooService, { optional: true }) satisfies Promise<FooChildService | undefined>;
        // @ts-expect-error
        private d = injectAsync(FooService, { optional: true }) satisfies FooService | undefined;
        // @ts-expect-error
        private e = injectAsync(FooChildService, { optional: true }) satisfies FooService | undefined;
      }
    });

    it("inject() with optional and multi", () => {
      class Foo {
        private a = inject(FooService, { optional: true, multi: true }) satisfies FooService[] | undefined;
        private b = inject(FooChildService, { optional: true, multi: true }) satisfies FooService[] | undefined;
        // @ts-expect-error
        private c = inject(FooService, { optional: true, multi: true }) satisfies FooChildService[] | undefined;
        // @ts-expect-error
        private d = inject(FooService, { optional: true, multi: true }) satisfies Promise<FooService[] | undefined>;
        private e = inject(FooChildService, {
          optional: true,
          multi: true,
          // @ts-expect-error
        }) satisfies Promise<FooService[] | undefined>;
      }
    });

    it("injectAsync() with optional and multi", () => {
      class Foo {
        private a = injectAsync(FooService, {
          optional: true,
          multi: true,
        }) satisfies Promise<FooService[] | undefined>;
        private b = injectAsync(FooChildService, {
          optional: true,
          multi: true,
        }) satisfies Promise<FooService[] | undefined>;
        private c = injectAsync(FooService, {
          optional: true,
          multi: true,
          // @ts-expect-error
        }) satisfies Promise<FooChildService[] | undefined>;
        // @ts-expect-error
        private d = injectAsync(FooService, { optional: true, multi: true }) satisfies FooService[] | undefined;
        // @ts-expect-error
        private e = injectAsync(FooChildService, { optional: true, multi: true }) satisfies FooService[] | undefined;
      }
    });
  });
});
