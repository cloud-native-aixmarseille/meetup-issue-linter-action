import { injectable, injectFromBase } from "inversify";
import { string } from "zod";
import { AbstractZodLinterAdapter } from "./abtract-zod-linter.adapter";

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
