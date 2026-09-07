import type { ReferentialCatalog } from "../../domain/referential-catalog.js";

export interface ReferentialChoiceProjection {
	readonly hostOptions: readonly string[];
	readonly speakerReferences: readonly string[];
}

export class ProjectReferentialChoices {
	execute(catalog: ReferentialCatalog): ReferentialChoiceProjection {
		return Object.freeze({
			hostOptions: Object.freeze(catalog.hosts.map((host) => host.displayName)),
			speakerReferences: Object.freeze(
				catalog.speakers.map((speaker) => speaker.displayName),
			),
		});
	}
}
