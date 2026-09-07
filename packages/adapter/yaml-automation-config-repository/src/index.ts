import {
	type AutomationConfig,
	type AutomationConfigRepository,
	parseAutomationConfig,
} from "@meetup-automation/journey";

export class YamlAutomationConfigRepository
	implements AutomationConfigRepository
{
	async load(): Promise<AutomationConfig> {
		return parseAutomationConfig(undefined);
	}
}
