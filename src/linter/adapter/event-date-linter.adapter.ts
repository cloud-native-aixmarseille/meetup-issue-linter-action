import { injectable, injectFromBase } from "inversify";
import { string } from "zod";
import { AbstractZodLinterAdapter } from "./abstract-zod-linter.adapter.js";

@injectable()
@injectFromBase({
  extendConstructorArguments: true,
})
export class EventDateLinterAdapter extends AbstractZodLinterAdapter {
  protected getValidator() {
    return string().date();
  }

  protected getFieldName() {
    return "event_date" as const;
  }
}
