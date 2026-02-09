import { LinterAdapter, LinterDependency } from "./adapter/linter.adapter.js";

type CompletedLinters = Map<LinterDependency, boolean>;

export class LinterSortedQueue {
  private linters: LinterAdapter[] = [];

  private readonly completedLinters: CompletedLinters = new Map();

  constructor(linters: LinterAdapter[]) {
    for (const linter of linters) {
      this.enqueue(linter);
    }
  }

  setCompletedLinter(linter: LinterAdapter, success: boolean) {
    this.completedLinters.set(linter.constructor as LinterDependency, success);
  }

  size(): number {
    return this.linters.length;
  }

  dequeue(): LinterAdapter | undefined {
    const linter = this.linters.shift();
    if (!linter) {
      return undefined;
    }

    if (this.linterHasUnresolvedDependencies(linter)) {
      this.enqueue(linter);
      return this.dequeue();
    }

    if (this.linterHasFailedDependencies(linter)) {
      this.setCompletedLinter(linter, false);
      return this.dequeue();
    }

    return linter;
  }

  private enqueue(linter: LinterAdapter): void {
    this.linters.push(linter);
    this.sortQueue();
  }

  private sortQueue(): void {
    const linters: Map<LinterDependency, LinterAdapter> = new Map();
    const dependencies: Map<LinterDependency, LinterDependency[]> = new Map();

    for (const linter of this.linters) {
      if (!linter) {
        continue;
      }
      const linterKey = linter.constructor as LinterDependency;
      const linterDependencies = linter.getDependencies();

      if (linters.has(linterKey)) {
        throw new Error(`Linter "${linterKey.name}" already exists.`);
      }

      linters.set(linterKey, linter);
      dependencies.set(linterKey, linterDependencies);
    }

    const visited = new Set<LinterDependency>();
    const result: LinterAdapter[] = [];
    const tempMark = new Set<LinterDependency>();

    const visit = (linterDependency: LinterDependency) => {
      if (tempMark.has(linterDependency)) {
        throw new Error(`Circular dependency detected involving "${linterDependency.name}"`);
      }
      if (!visited.has(linterDependency)) {
        tempMark.add(linterDependency);
        const deps = dependencies.get(linterDependency) || [];
        for (const dep of deps) {
          visit(dep);
        }
        tempMark.delete(linterDependency);
        visited.add(linterDependency);
        result.push(linters.get(linterDependency)!);
      }
    };

    for (const linterConstructor of linters.keys()) {
      if (!visited.has(linterConstructor)) {
        visit(linterConstructor);
      }
    }
    this.linters = result;
  }

  private linterHasUnresolvedDependencies(linter: LinterAdapter): boolean {
    const dependencies = linter.getDependencies();

    return dependencies.some((dependency) => !this.completedLinters.has(dependency));
  }

  private linterHasFailedDependencies(linter: LinterAdapter) {
    const dependencies = linter.getDependencies();

    return dependencies.some((dependency) => this.completedLinters.get(dependency) === false);
  }
}
