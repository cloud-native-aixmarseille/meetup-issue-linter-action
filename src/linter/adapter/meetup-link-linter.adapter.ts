import { injectable } from "inversify";
import { AbstractLinkLinterAdapter } from "./abstract-link-linter.adapter";

@injectable()
export class MeetupLinkLinterAdapter extends AbstractLinkLinterAdapter {
  private static readonly MEETUP_LINK_REGEX =
    /^https:\/\/www\.meetup\.com\/cloud-native-aix-marseille\/events\/[0-9]+\/?$/;

  protected getLinkRegex() {
    return MeetupLinkLinterAdapter.MEETUP_LINK_REGEX;
  }

  protected getErrorMessage() {
    return "Must be a valid Meetup link, e.g. https://www.meetup.com/cloud-native-aix-marseille/events/123456789";
  }

  protected getFieldName() {
    return "meetup_link" as const;
  }
}
