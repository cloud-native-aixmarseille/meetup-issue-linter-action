import { context, getOctokit } from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import { inject, injectable } from "inversify";

import { InputService } from "./input.service.js";

type Octokit = InstanceType<typeof GitHub>;

export type GithubIssue = {
  number: number;
  title: string;
  labels: string[];
  body: string;
};

export type UpdatableGithubIssue = Partial<Omit<GithubIssue, "number">>;

export const UpdatableGithubIssueFields = Object.keys({
  title: "",
  labels: [],
  body: "",
} as UpdatableGithubIssue) as (keyof UpdatableGithubIssue)[];

@injectable()
export class GitHubService {
  private octokit: Octokit | undefined;

  constructor(@inject(InputService) private readonly inputService: InputService) {}

  async getIssue(issueNumber: number): Promise<GithubIssue> {
    const { data: issue } = await this.getOctokit().rest.issues.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNumber,
    });

    const labels: string[] = issue.labels
      .map((label) => ("string" === typeof label ? label : label.name))
      .filter(Boolean) as string[];

    return {
      number: issue.number,
      title: issue.title,
      body: issue.body || "",
      labels,
    };
  }

  async updateIssue(issueNumber: number, issue: UpdatableGithubIssue): Promise<void> {
    const { title, body, labels } = issue;

    await this.getOctokit().rest.issues.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNumber,
      title,
      body,
      labels,
    });
  }

  private getOctokit(): Octokit {
    if (this.octokit) {
      return this.octokit;
    }
    return (this.octokit = getOctokit(this.inputService.getGithubToken()));
  }
}
