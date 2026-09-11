import type { PublicationDiagnostic } from "../domain/model.js";
import type {
	AssetContainer,
	AssetFile,
	AssetRepository,
	AssetTemplate,
} from "./ports.js";

export type ReconcileEventAssetsResult = Readonly<{
	container?: AssetContainer;
	files: Readonly<Record<string, string>>;
	diagnostics: readonly PublicationDiagnostic[];
}>;

export class ReconcileEventAssets {
	constructor(private readonly repository: AssetRepository) {}

	async execute(input: {
		eventId: string;
		date: string;
		hostName: string;
		existingUrl?: string;
		mode: "check" | "fix";
	}): Promise<ReconcileEventAssetsResult> {
		const date = input.date.trim();
		const host = input.hostName.trim();
		if (!validDate(date) || !host) {
			return {
				files: {},
				diagnostics: [
					diagnostic(
						"prerequisites",
						"A valid event date and resolved host are required to reconcile assets",
						false,
					),
				],
			};
		}
		// Validate the complete template catalog before performing any mutation.
		const templates = await this.repository.listTemplates();
		validateTemplates(templates);
		const month = new Intl.DateTimeFormat("en-US", {
			month: "long",
			timeZone: "UTC",
		}).format(new Date(`${date}T00:00:00Z`));
		const request = {
			eventId: input.eventId,
			idempotencyKey: `${input.eventId}:assets:v1`,
			title: `${date} - ${month} - ${host}`,
		};
		const diagnostics: PublicationDiagnostic[] = [];
		let container = await this.repository.findContainer(request);
		if (!container || container.name !== request.title) {
			diagnostics.push(
				diagnostic(
					"container.drift",
					"The event asset folder must be created or renamed",
					input.mode === "fix",
				),
			);
			if (input.mode === "fix")
				container = await this.repository.ensureContainer(request);
		}
		if (!container) return { files: {}, diagnostics };
		if (container.url !== input.existingUrl) {
			diagnostics.push(
				diagnostic(
					"link.drift",
					"The event asset link must reference the managed folder",
					input.mode === "fix",
				),
			);
		}
		const currentFiles = await this.repository.listFiles(container.id);
		const files: Record<string, string> = {};
		for (const template of templates) {
			const name = template.name.replaceAll("[EVENT_DATE:YYYY-MM-DD]", date);
			const matches = currentFiles.filter(
				(file) => file.templateId === template.id,
			);
			if (matches.length > 1)
				throw new Error(
					"Ambiguous event asset copies require manual reconciliation",
				);
			let file: AssetFile | undefined = matches[0];
			if (!file || file.name !== name || file.kind !== template.kind) {
				diagnostics.push(
					diagnostic(
						"file.drift",
						"An event template copy is missing or its name or template metadata has changed",
						input.mode === "fix",
					),
				);
				if (input.mode === "fix") {
					file = file
						? await this.repository.updateFile(file, template, name)
						: await this.repository.copyTemplate(container.id, template, name);
				}
			}
			if (file?.url) files[`${template.kind}-link`] = file.url;
		}
		return { container, files, diagnostics };
	}
}

function diagnostic(
	code: string,
	message: string,
	fixApplied: boolean,
): PublicationDiagnostic {
	return {
		code: `publication.assets.${code}`,
		field: "assets",
		severity: "warning",
		message,
		fixAvailable: code !== "prerequisites",
		fixApplied,
	};
}

function validDate(date: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
	const instant = new Date(`${date}T00:00:00Z`);
	return (
		!Number.isNaN(instant.valueOf()) &&
		instant.toISOString().slice(0, 10) === date
	);
}

function validateTemplates(templates: readonly AssetTemplate[]): void {
	if (
		!templates.length ||
		templates.some(
			(template) =>
				!template.id || !template.name.trim() || !template.kind.trim(),
		) ||
		new Set(templates.map(({ id }) => id)).size !== templates.length ||
		new Set(templates.map(({ kind }) => kind)).size !== templates.length
	) {
		throw new Error(
			"Asset templates must have unique IDs, unique kinds, and non-empty names",
		);
	}
}
