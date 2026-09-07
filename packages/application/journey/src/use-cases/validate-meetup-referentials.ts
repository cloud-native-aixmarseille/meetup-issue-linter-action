import {
	type ReferentialCatalog,
	type ReferentialRepository,
	ValidateReferentialCatalog,
} from "@meetup-automation/referential";
import type {
	AutomationConfig,
	AutomationConfigRepository,
} from "../config/automation-config.js";
import type { PublicDiagnostic } from "../result/result-envelope.js";

export interface ValidateMeetupReferentialsDependencies {
	configRepository: AutomationConfigRepository;
	createReferentialRepository(config: AutomationConfig): ReferentialRepository;
}

export type ValidateMeetupReferentialsResult =
	| {
			isValid: true;
			config: AutomationConfig;
			catalog: ReferentialCatalog;
			diagnostics: readonly PublicDiagnostic[];
	  }
	| {
			isValid: false;
			config: AutomationConfig;
			diagnostics: readonly PublicDiagnostic[];
	  };

export class ValidateMeetupReferentials {
	constructor(
		private readonly dependencies: ValidateMeetupReferentialsDependencies,
	) {}

	async execute(configPath: string): Promise<ValidateMeetupReferentialsResult> {
		const config = await this.dependencies.configRepository.load(configPath);
		const repository = this.dependencies.createReferentialRepository(config);
		const validation = await new ValidateReferentialCatalog(
			repository,
		).execute();
		const diagnostics = validation.diagnostics.map((item) => ({
			code: item.code,
			severity: item.severity,
			field: item.path,
			message: item.message,
		}));
		return validation.isValid
			? { isValid: true, config, catalog: validation.catalog, diagnostics }
			: { isValid: false, config, diagnostics };
	}
}
