import { injectable, injectFromBase } from "inversify";
import { AbstractLinkLinterAdapter } from "./abstract-link-linter.adapter";

@injectable()
@injectFromBase({
  extendConstructorArguments: true,
})
export class DriveLinkLinterAdapter extends AbstractLinkLinterAdapter {
  private static readonly DRIVE_LINK_REGEX =
    /^https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9-_]+\/?$/;

  protected getLinkRegex() {
    return DriveLinkLinterAdapter.DRIVE_LINK_REGEX;
  }

  protected getErrorMessage() {
    return "Must be a valid Drive Link, e.g. https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j";
  }

  protected getFieldName() {
    return "drive_link" as const;
  }
}
