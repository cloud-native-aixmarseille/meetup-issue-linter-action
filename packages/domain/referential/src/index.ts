export type { ReferentialRepository } from "./application/ports/referential-repository.js";
export {
	ProjectReferentialChoices,
	type ReferentialChoiceProjection,
} from "./application/use-cases/project-referential-choices.js";
export {
	ResolveEventReferences,
	type ResolveEventReferencesCommand,
	type ResolveEventReferencesResult,
} from "./application/use-cases/resolve-event-references.js";
export {
	type ReferentialCatalogValidation,
	ValidateReferentialCatalog,
} from "./application/use-cases/validate-referential-catalog.js";
export type { ContactId, HostId, SpeakerId } from "./domain/identifiers.js";
export type {
	Host,
	HostContact,
	RawHostRecord,
	RawReferentialCatalog,
	RawSpeakerRecord,
	ReferentialCatalog,
	Speaker,
} from "./domain/referential-catalog.js";
export type {
	ReferentialDiagnostic,
	ReferentialDiagnosticCode,
	ReferentialDiagnosticSeverity,
} from "./domain/referential-diagnostic.js";
