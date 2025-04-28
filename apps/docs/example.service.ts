import { injectable } from "@needle-di/core";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export abstract class ExampleService {
  /* ... */
}

@injectable()
export class FooService extends ExampleService {
  /* ... */
}

@injectable()
export class BarService extends ExampleService {
  /* ... */
}
