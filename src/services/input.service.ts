import { inject, injectable } from "inversify";
import { CoreService, CORE_SERVICE_IDENTIFIER } from "./core.service";

export enum InputNames {
  IssueNumber = "issue-number",
  IssueParsedBody = "issue-parsed-body",
  Hosters = "hosters",
  Speakers = "speakers",
  FailOnError = "fail-on-error",
  ShouldFix = "should-fix",
  GithubToken = "github-token",
}

type NonEmptyArrayOfStrings = [string, ...string[]];

export type SpeakerWithUrl = {
  name: string;
  url: string;
};

type NonEmptyArrayOfSpeakers = [SpeakerWithUrl, ...SpeakerWithUrl[]];

@injectable()
export class InputService {
  constructor(@inject(CORE_SERVICE_IDENTIFIER) private readonly coreService: CoreService) {}

  getIssueNumber(): number {
    return parseInt(
      this.coreService.getInput(InputNames.IssueNumber, {
        required: true,
      })
    );
  }

  getIssueParsedBody(): Record<string, unknown> {
    const issueParsedBody = this.coreService.getInput(InputNames.IssueParsedBody, {
      required: true,
    });

    return JSON.parse(issueParsedBody);
  }

  getHosters(): NonEmptyArrayOfStrings {
    return this.getNonEmptyArrayOfStringsInput(InputNames.Hosters);
  }

  getSpeakers(): NonEmptyArrayOfSpeakers {
    const inputValue = this.coreService.getInput(InputNames.Speakers, {
      required: true,
    });

    const parsedInput = JSON.parse(inputValue);

    if (!Array.isArray(parsedInput)) {
      throw new Error(`"${InputNames.Speakers}" input must be an array`);
    }

    if (parsedInput.length === 0) {
      throw new Error(`"${InputNames.Speakers}" input must not be empty`);
    }

    for (const parsedInputValue of parsedInput) {
      if (typeof parsedInputValue !== "object" || parsedInputValue === null) {
        throw new Error(
          `"${InputNames.Speakers}" input value "${JSON.stringify(parsedInputValue)}" must be an object`
        );
      }

      if (typeof parsedInputValue.name !== "string") {
        throw new Error(
          `"${InputNames.Speakers}" input value "${JSON.stringify(parsedInputValue)}" must have a "name" property of type string`
        );
      }

      if (typeof parsedInputValue.url !== "string") {
        throw new Error(
          `"${InputNames.Speakers}" input value "${JSON.stringify(parsedInputValue)}" must have a "url" property of type string`
        );
      }
    }

    return parsedInput as NonEmptyArrayOfSpeakers;
  }

  getShouldFix(): boolean {
    return this.coreService.getBooleanInput(InputNames.ShouldFix);
  }

  getFailOnError() {
    return this.coreService.getBooleanInput(InputNames.FailOnError);
  }

  getGithubToken(): string {
    return this.coreService.getInput(InputNames.GithubToken, {
      required: true,
    });
  }

  private getNonEmptyArrayOfStringsInput(inputName: InputNames): NonEmptyArrayOfStrings {
    const inputValue = this.coreService.getInput(inputName, {
      required: true,
    });

    const parsedInput = JSON.parse(inputValue);

    if (!Array.isArray(parsedInput)) {
      throw new Error(`"${inputName}" input must be an array`);
    }

    if (parsedInput.length === 0) {
      throw new Error(`"${inputName}" input must not be empty`);
    }

    for (const parsedInputValue of parsedInput) {
      if (typeof parsedInputValue !== "string") {
        throw new Error(
          `"${inputName}" input value "${JSON.stringify(parsedInputValue)}" (${typeof parsedInputValue}) must be of string`
        );
      }
    }

    return parsedInput as NonEmptyArrayOfStrings;
  }
}
