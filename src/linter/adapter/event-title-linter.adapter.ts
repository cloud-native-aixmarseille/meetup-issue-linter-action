import { injectable, injectFromBase } from "inversify";
import { string } from "zod";
import { AbstractZodLinterAdapter } from "./abstract-zod-linter.adapter";

@injectable()
@injectFromBase({
  extendConstructorArguments: true,
})
export class EventTitleLinterAdapter extends AbstractZodLinterAdapter {
  protected getValidator() {
    return string().nonempty({
      message: "Must not be empty",
    });
  }

  protected getFieldName() {
    return "event_title" as const;
  }
}
