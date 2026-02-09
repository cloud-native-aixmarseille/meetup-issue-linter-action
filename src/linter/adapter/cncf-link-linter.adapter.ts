import { injectable, injectFromBase } from "inversify";
import { AbstractLinkLinterAdapter } from "./abstract-link-linter.adapter.js";

@injectable()
@injectFromBase({
  extendConstructorArguments: true,
})
export class CNCFLinkLinterAdapter extends AbstractLinkLinterAdapter {
  private static readonly CNCF_LINK_REGEX =
    /^https:\/\/community\.cncf\.io\/events\/details\/cncf-cloud-native-aix-marseille-presents-[0-9a-z-]+\/?$/;

  protected getLinkRegex() {
    return CNCFLinkLinterAdapter.CNCF_LINK_REGEX;
  }

  protected getErrorMessage() {
    return "Must be a valid CNCF link, e.g. https://community.cncf.io/events/details/cncf-cloud-native-aix-marseille-presents-test-meetup-event";
  }

  protected getFieldName() {
    return "cncf_link" as const;
  }
}
