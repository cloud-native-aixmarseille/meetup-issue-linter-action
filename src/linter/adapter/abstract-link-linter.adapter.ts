import { injectable, injectFromBase } from "inversify";
import { string } from "zod";
import { AbstractZodLinterAdapter } from "./abstract-zod-linter.adapter";

@injectable()
@injectFromBase({
  extendConstructorArguments: true,
})
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
