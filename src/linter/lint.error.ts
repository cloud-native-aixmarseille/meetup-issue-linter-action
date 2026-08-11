export class LintError extends Error {
	constructor(private readonly messages: string[]) {
		super(messages.join("; "));
		this.name = "LintError";
		Object.setPrototypeOf(this, new.target.prototype);
	}

	getMessages(): string[] {
		return this.messages;
	}

	merge(lintError: LintError): LintError {
		return new LintError([...this.messages, ...lintError.getMessages()]);
	}
}
