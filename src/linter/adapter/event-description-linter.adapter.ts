import { injectable } from "inversify";
import { string } from "zod";
import { AbstractZodLinterAdapter } from "./abtract-zod-linter.adapter";

@injectable()
export class EventDescriptionLinterAdapter extends AbstractZodLinterAdapter {
  protected getValidator() {
    return string().nonempty({
      message: "Must not be empty",
    });
  }

  protected getFieldName() {
    return "event_description" as const;
  }
}
