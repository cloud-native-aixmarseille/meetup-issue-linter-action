import { LinterSortedQueue } from "./linter.sorted-queue";
import { type LinterAdapter, type LinterDependency } from "./adapter/linter.adapter";
import { type MeetupIssue } from "../services/meetup-issue.service";

class BaseAdapter implements LinterAdapter {
  constructor(private readonly dependencies: LinterDependency[] = []) {}

  getName(): string {
    return this.constructor.name;
  }

  getDependencies(): LinterDependency[] {
    return this.dependencies;
  }

  // Not used in these tests; return input to satisfy interface
  async lint(meetupIssue: MeetupIssue): Promise<MeetupIssue> {
    return meetupIssue;
  }
}

describe("LinterSortedQueue", () => {
  it("rotates queue when dependencies are unresolved and resumes after completion", () => {
    class MissingDep extends BaseAdapter {}
    class DependentAdapter extends BaseAdapter {
      constructor() {
        super([MissingDep]);
      }
    }
    class IndependentAdapter extends BaseAdapter {}

    const missingDep = new MissingDep();
    const queue = new LinterSortedQueue([
      new DependentAdapter(),
      new IndependentAdapter(),
      missingDep,
    ]);

    const first = queue.dequeue();
    expect(first?.getName()).toBe("MissingDep");

    const second = queue.dequeue();
    expect(second?.getName()).toBe("IndependentAdapter");

    const queueWithCompletedDep = new LinterSortedQueue([
      new DependentAdapter(),
      new IndependentAdapter(),
      missingDep,
    ]);

    queueWithCompletedDep.setCompletedLinter(missingDep, true);

    const remaining: string[] = [];
    for (let i = 0; i < 3; i++) {
      const next = queueWithCompletedDep.dequeue();
      if (!next) {
        break;
      }
      remaining.push(next.getName());
    }

    expect(remaining).toContain("DependentAdapter");
  });

  it("skips linters whose dependencies have failed", () => {
    class UpstreamAdapter extends BaseAdapter {}
    class DownstreamAdapter extends BaseAdapter {
      constructor() {
        super([UpstreamAdapter]);
      }
    }

    const upstream = new UpstreamAdapter();
    const downstream = new DownstreamAdapter();

    const queue = new LinterSortedQueue([upstream, downstream]);

    const first = queue.dequeue();
    expect(first?.getName()).toBe("UpstreamAdapter");

    queue.setCompletedLinter(upstream, false);

    expect(queue.dequeue()).toBeUndefined();
    expect(queue.getCompletedLinters().get("DownstreamAdapter")).toBe(false);
  });
});
