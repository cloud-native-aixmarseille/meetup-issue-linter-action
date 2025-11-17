export type PublicationReferences = Readonly<{
	meetup?: string;
	community?: string;
	assets?: string;
}>;

export type PublicationEvent = Readonly<{
	eventId: string;
	title: string;
	description: string;
	date: string;
	timeZone: string;
	occurrenceStatus?: "scheduled" | "postponed" | "held" | "cancelled";
	references: PublicationReferences;
	slidesPublished: boolean;
	attendanceImported: boolean;
}>;

export type PublicationDiagnostic = Readonly<{
	code: string;
	severity: "info" | "warning" | "error";
	field: keyof PublicationReferences;
	message: string;
	fixAvailable?: boolean;
	fixApplied?: boolean;
}>;

export type PublicationPatchOperation = {
	[P in keyof PublicationReferences]-?: Readonly<{
		op: "replace";
		path: P;
		value: PublicationReferences[P];
		reason: string;
	}>;
}[keyof PublicationReferences];

export type PublicationPatch = Readonly<{
	operations: readonly PublicationPatchOperation[];
}>;

export type PublicationEvaluation = Readonly<{
	references: PublicationReferences;
	diagnostics: readonly PublicationDiagnostic[];
	patch: PublicationPatch;
}>;

export function applyPublicationPatch(
	references: PublicationReferences,
	patch: PublicationPatch,
): PublicationReferences {
	const result: {
		meetup?: string;
		community?: string;
		assets?: string;
	} = { ...references };
	for (const operation of patch.operations) {
		switch (operation.path) {
			case "meetup":
				result.meetup = operation.value;
				break;
			case "community":
				result.community = operation.value;
				break;
			case "assets":
				result.assets = operation.value;
				break;
		}
	}
	return result;
}
