export interface EventClock {
	/** Returns an RFC 3339 instant. */
	now(): string;
}
