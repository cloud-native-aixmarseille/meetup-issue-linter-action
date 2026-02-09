import { injectable, injectFromBase } from "inversify";
import { url } from "zod";
import { AbstractZodLinterAdapter } from "./abstract-zod-linter.adapter.js";

@injectable()
@injectFromBase({
  extendConstructorArguments: true,
})
export abstract class AbstractLinkLinterAdapter extends AbstractZodLinterAdapter {
  protected getValidator() {
    const linkRegex = this.getLinkRegex();
    const errorMessage = this.getErrorMessage();

    return url()
      .regex(linkRegex, {
        message: errorMessage,
      })
      .transform((url) => url.replace(/\/$/, ""));
  }

  protected abstract getLinkRegex(): RegExp;
  protected abstract getErrorMessage(): string;
}
