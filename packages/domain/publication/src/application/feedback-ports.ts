export interface FeedbackLinkGateway {
	/** Update only the target of the configured existing short link. */
	updateTarget(url: string): Promise<boolean>;
}

export interface FeedbackEventGateway {
	/** Create or recover the event identified by a stable source key. */
	ensureEvent(input: {
		readonly key: string;
		readonly name: string;
		readonly scheduleUrl: string;
	}): Promise<string>;
}
