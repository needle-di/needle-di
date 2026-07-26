import { injectable } from "@needle-di/core";

@injectable()
export class FooService {
  // ...
  someMethod() {return "Return of FooService.someMethod()" as const}
}
