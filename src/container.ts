import { Container, ContainerModule } from "inversify";
import { AgendaLinterAdapter } from "./linter/adapter/agenda-linter.adapter.js";
import { CNCFLinkLinterAdapter } from "./linter/adapter/cncf-link-linter.adapter.js";
import { DriveLinkLinterAdapter } from "./linter/adapter/drive-link-linter.adapter.js";
import { EventDateLinterAdapter } from "./linter/adapter/event-date-linter.adapter.js";
import { EventDescriptionLinterAdapter } from "./linter/adapter/event-description-linter.adapter.js";
import { EventTitleLinterAdapter } from "./linter/adapter/event-title-linter.adapter.js";
import { HosterLinterAdapter } from "./linter/adapter/hoster-linter.adapter.js";
import { LabelsLinterAdapter } from "./linter/adapter/labels-linter.adapter.js";
import {
	LINTER_ADAPTER_IDENTIFIER,
	type LinterAdapter,
} from "./linter/adapter/linter.adapter.js";
import { MeetupLinkLinterAdapter } from "./linter/adapter/meetup-link-linter.adapter.js";
import { TitleLinterAdapter } from "./linter/adapter/title-linter.adapter.js";
import { LinterService } from "./linter/linter.service.js";
import {
	CORE_SERVICE_IDENTIFIER,
	type CoreService,
	coreService,
} from "./services/core.service.js";
import { GitHubService } from "./services/github.service.js";
import { InputService } from "./services/input.service.js";
import { LoggerService } from "./services/logger.service.js";
import { MeetupIssueService } from "./services/meetup-issue.service.js";

const linterAdapters = [
	EventDateLinterAdapter,
	EventTitleLinterAdapter,
	TitleLinterAdapter,
	HosterLinterAdapter,
	EventDescriptionLinterAdapter,
	AgendaLinterAdapter,
	MeetupLinkLinterAdapter,
	CNCFLinkLinterAdapter,
	DriveLinkLinterAdapter,
	LabelsLinterAdapter,
] as const;

const applicationModule = new ContainerModule(({ bind }) => {
	bind<CoreService>(CORE_SERVICE_IDENTIFIER).toConstantValue(coreService);

	bind(GitHubService).toSelf();
	bind(InputService).toSelf();
	bind(LinterService).toSelf();
	bind(LoggerService).toSelf();
	bind(MeetupIssueService).toSelf();

	for (const linterAdapter of linterAdapters) {
		bind<LinterAdapter>(LINTER_ADAPTER_IDENTIFIER).to(linterAdapter);
	}
});

export function createContainer(): Container {
	const container = new Container();
	container.load(applicationModule);

	return container;
}

const container = createContainer();

export { container };
