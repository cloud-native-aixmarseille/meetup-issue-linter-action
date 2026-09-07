import type { CommunicationClock } from "@meetup-automation/communication";
import type { EventClock } from "@meetup-automation/event";

export type DateFactory = () => Date;

export class SystemCommunicationClock implements CommunicationClock {
	constructor(private readonly dateFactory: DateFactory = () => new Date()) {}
	now(): Date {
		return this.dateFactory();
	}
}

export class SystemEventClock implements EventClock {
	constructor(private readonly dateFactory: DateFactory = () => new Date()) {}
	now(): string {
		return this.dateFactory().toISOString();
	}
}
