import { MessageLocalizer } from "@meetup-automation/localization";
import { CATALOGS, type MessageId } from "./catalog.js";
import type { MessageParameters } from "./message-parameters.js";
export class OrganizerNotificationMessages extends MessageLocalizer<
	MessageId,
	MessageParameters
> {
	constructor(locale = "en") {
		super(CATALOGS, locale);
	}
	get policyRevision(): string {
		return this.locale === "en" ? "" : "organizer-attention.fr.v2";
	}
}
