import {
	type EventIdentity,
	ensureEventDocumentIsCurrent,
	eventRepositoryPatchIsEmpty,
} from "@meetup-automation/event";
import {
	type AssetRepository,
	ReconcileEventAssets,
} from "@meetup-automation/publication";
import type { PublicDiagnostic } from "../result/result-envelope.js";
import {
	ManageMeetupEvent,
	type ManageMeetupEventDependencies,
} from "./manage-meetup-event.js";

export class ManageMeetupAssets {
	constructor(
		private readonly dependencies: ManageMeetupEventDependencies & {
			assetRepository: AssetRepository;
		},
	) {}

	async execute(input: {
		configPath: string;
		identity: EventIdentity;
		mode: "check" | "fix";
	}): Promise<{
		skipped: boolean;
		persisted: boolean;
		assetUrl?: string;
		files: Readonly<Record<string, string>>;
		diagnostics: readonly PublicDiagnostic[];
	}> {
		const config = await this.dependencies.configRepository.load(
			input.configPath,
		);
		const composition = this.dependencies.createEventDependencies(config);
		const source = await composition.repository.find(input.identity);
		if (!source) throw new Error("Meetup event was not found");
		const evaluation = await new ManageMeetupEvent({
			...this.dependencies,
			configRepository: { load: async () => config },
			createEventDependencies: () => composition,
		}).execute({ ...input, mode: "check", sourceDocument: source });
		if (evaluation.skipped || evaluation.event.occurrenceStatus === "cancelled")
			return { skipped: true, persisted: false, files: {}, diagnostics: [] };
		if (
			!evaluation.event.host?.id ||
			evaluation.diagnostics.some(
				(item) =>
					item.severity === "error" &&
					(item.code.startsWith("referential.") ||
						/host|date/i.test(item.field ?? "")),
			)
		) {
			return {
				skipped: true,
				persisted: false,
				files: {},
				diagnostics: [
					{
						code: "publication.assets.prerequisites",
						severity: "warning",
						field: "publicationLinks.assets",
						message:
							"Resolve the event host and date before reconciling assets",
					},
				],
			};
		}
		if (input.mode === "fix")
			await ensureEventDocumentIsCurrent(
				composition.repository,
				input.identity,
				source,
			);
		const assets = await new ReconcileEventAssets(
			this.dependencies.assetRepository,
		).execute({
			eventId: `${input.identity.repository}#${input.identity.issueNumber}`,
			date: evaluation.event.date,
			hostName: evaluation.event.host.displayName,
			existingUrl: evaluation.event.publicationLinks.assets,
			mode: input.mode,
		});
		let persisted = false;
		if (input.mode === "fix" && assets.container) {
			// Only project the asset reference. Event normalization remains owned by
			// event reconciliation and the versioned codec owns all Markdown edits.
			const original = composition.documentCodec.decode(source).event;
			const patch = composition.documentCodec.createPatch(source, {
				...original,
				publicationLinks: {
					...original.publicationLinks,
					assets: assets.container.url,
				},
			});
			if (!eventRepositoryPatchIsEmpty(patch)) {
				await ensureEventDocumentIsCurrent(
					composition.repository,
					input.identity,
					source,
				);
				await composition.repository.applyPatch(input.identity, patch);
				persisted = true;
			}
		}
		return {
			skipped: false,
			persisted,
			assetUrl: assets.container?.url,
			files: assets.files,
			diagnostics: assets.diagnostics.map((item) => ({
				...item,
				field: "publicationLinks.assets",
			})),
		};
	}
}
