import { Container } from "inversify";
import { LoggerService } from "./services/logger.service.js";
import { CORE_SERVICE_IDENTIFIER, coreService, CoreService } from "./services/core.service.js";
import { InputService } from "./services/input.service.js";
import { LinterService } from "./linter/linter.service.js";
import { GitHubService } from "./services/github.service.js";
import { EventDateLinterAdapter } from "./linter/adapter/event-date-linter.adapter.js";
import { LINTER_ADAPTER_IDENTIFIER, LinterAdapter } from "./linter/adapter/linter.adapter.js";
import { MeetupIssueService } from "./services/meetup-issue.service.js";
import { EventTitleLinterAdapter } from "./linter/adapter/event-title-linter.adapter.js";
import { TitleLinterAdapter } from "./linter/adapter/title-linter.adapter.js";
import { EventDescriptionLinterAdapter } from "./linter/adapter/event-description-linter.adapter.js";
import { HosterLinterAdapter } from "./linter/adapter/hoster-linter.adapter.js";
import { AgendaLinterAdapter } from "./linter/adapter/agenda-linter.adapter.js";
import { MeetupLinkLinterAdapter } from "./linter/adapter/meetup-link-linter.adapter.js";
import { DriveLinkLinterAdapter } from "./linter/adapter/drive-link-linter.adapter.js";
import { CNCFLinkLinterAdapter } from "./linter/adapter/cncf-link-linter.adapter.js";
import { LabelsLinterAdapter } from "./linter/adapter/labels-linter.adapter.js";

const container = new Container();

container.bind<CoreService>(CORE_SERVICE_IDENTIFIER).toConstantValue(coreService);

container.bind(GitHubService).toSelf();
container.bind(InputService).toSelf();
container.bind(LinterService).toSelf();
container.bind(LoggerService).toSelf();
container.bind(MeetupIssueService).toSelf();

// Linters
container.bind<LinterAdapter>(LINTER_ADAPTER_IDENTIFIER).to(EventDateLinterAdapter);
container.bind<LinterAdapter>(LINTER_ADAPTER_IDENTIFIER).to(EventTitleLinterAdapter);
container.bind<LinterAdapter>(LINTER_ADAPTER_IDENTIFIER).to(TitleLinterAdapter);
container.bind<LinterAdapter>(LINTER_ADAPTER_IDENTIFIER).to(HosterLinterAdapter);
container.bind<LinterAdapter>(LINTER_ADAPTER_IDENTIFIER).to(EventDescriptionLinterAdapter);
container.bind<LinterAdapter>(LINTER_ADAPTER_IDENTIFIER).to(AgendaLinterAdapter);
container.bind<LinterAdapter>(LINTER_ADAPTER_IDENTIFIER).to(MeetupLinkLinterAdapter);
container.bind<LinterAdapter>(LINTER_ADAPTER_IDENTIFIER).to(CNCFLinkLinterAdapter);
container.bind<LinterAdapter>(LINTER_ADAPTER_IDENTIFIER).to(DriveLinkLinterAdapter);
container.bind<LinterAdapter>(LINTER_ADAPTER_IDENTIFIER).to(LabelsLinterAdapter);

export { container };
