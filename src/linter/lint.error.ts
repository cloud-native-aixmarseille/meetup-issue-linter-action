import type { MeetupIssueBodyFields } from "../services/meetup-issue.service.js";

export type LintIssueField = `parsedBody.${MeetupIssueBodyFields}` | "title" | "labels";

export type LintIssue = {
  field?: LintIssueField;
  value?: unknown;
  message: string;
};

export class LintError extends Error {
  private readonly issues!: LintIssue[];

  constructor(issues: Array<string | LintIssue>) {
    const normalized = issues.map((issue) =>
      typeof issue === "string" ? { message: issue } : issue
    );

    super(normalized.map((issue) => issue.message).join("; "));
    this.name = "LintError";
    Object.setPrototypeOf(this, new.target.prototype);

    Object.defineProperty(this, "issues", {
      value: normalized,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }

  getMessages(): string[] {
    return this.issues.map((issue) => issue.message);
  }

  getIssues(): LintIssue[] {
    return [...this.issues];
  }

  merge(lintError: LintError): LintError {
    return new LintError([...this.issues, ...lintError.getIssues()]);
  }
}
