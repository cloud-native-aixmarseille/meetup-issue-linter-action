const SAFE_ERROR_NAMES = new Set([
	"GoogleDriveAssetRepositoryError",
	"EventNotFoundError",
	"EventConcurrentModificationError",
	"GitHubEventRepositoryConfigurationError",
	"GitHubEventRepositoryScopeError",
	"GitHubEventRepositoryResponseError",
	"GitHubEventCommentRepositoryConfigurationError",
	"GitHubEventCommentRepositoryScopeError",
	"GitHubEventCommentRepositoryResponseError",
	"ZodError",
]);

export function positiveIntegerInput(name: string, value: string): number {
	if (!/^\d+$/.test(value)) {
		throw new Error(`${name} must be a positive integer`);
	}
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new Error(`${name} must be a positive integer`);
	}
	return parsed;
}

export function enumInput<const T extends string>(
	name: string,
	value: string,
	allowed: readonly T[],
): T {
	if (!allowed.includes(value as T)) {
		throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
	}
	return value as T;
}

export function booleanInput(name: string, value: string): boolean {
	if (value === "true") return true;
	if (value === "false") return false;
	throw new Error(`${name} must be true or false`);
}

/** Never expose provider responses, input values, or contact data in failures. */
export function publicErrorMessage(error: unknown): string {
	if (error instanceof Error && SAFE_ERROR_NAMES.has(error.name)) {
		return `${error.name}: ${error.message}`;
	}
	return "Meetup automation failed; inspect debug logs using a trusted runner";
}
