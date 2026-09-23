export class FeedbackPolicy {
	static validDate(value: string): boolean {
		const date = new Date(`${value}T00:00:00Z`);
		return (
			/^\d{4}-\d{2}-\d{2}$/.test(value) &&
			!Number.isNaN(date.valueOf()) &&
			date.toISOString().slice(0, 10) === value
		);
	}

	static pollUrl(value: string): string {
		const url = new URL(value);
		if (
			url.origin !== "https://openfeedback.io" ||
			url.username ||
			url.password ||
			!/^\/[a-zA-Z0-9_-]+(?:\/(?:\d{4}-\d{2}-\d{2}|0))?\/?$/.test(
				url.pathname,
			) ||
			url.search ||
			url.hash
		)
			throw new Error("Feedback link must be an OpenFeedback event URL");
		return url.href.replace(/\/$/, "");
	}

	static isEventDay(date: string, now: string, timeZone: string): boolean {
		const today = new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(new Date(now));
		return date === today;
	}
}
