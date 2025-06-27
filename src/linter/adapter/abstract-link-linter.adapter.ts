import { injectable } from "inversify";
import { string } from "zod";
import { AbstractZodLinterAdapter } from "./abtract-zod-linter.adapter";

@injectable()
export abstract class AbstractLinkLinterAdapter extends AbstractZodLinterAdapter {
  protected getValidator() {
    const linkRegex = this.getLinkRegex();
    const errorMessage = this.getErrorMessage();

    return string()
      .url()
      .regex(linkRegex, {
        message: errorMessage,
      })
      .transform((url) => url.replace(/\/$/, ""));
  }

  protected abstract getLinkRegex(): RegExp;
  protected abstract getErrorMessage(): string;
}
