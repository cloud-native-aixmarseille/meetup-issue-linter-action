import { Container } from "inversify";
import { LoggerService } from "./services/logger.service";
import { CORE_SERVICE_IDENTIFIER, coreService, CoreService } from "./services/core.service";
import { InputService } from "./services/input.service";
import { LinterService } from "./linter/linter.service";
import { GithubService } from "./services/github.service";
import { EventDateLinterAdapter } from "./linter/adapter/event-date-linter.adapter";
import { LINTER_ADAPTER_IDENTIFIER, LinterAdapter } from "./linter/adapter/linter.adapter";
import { MeetupIssueService } from "./services/meetup-issue.service";
import { EventTitleLinterAdapter } from "./linter/adapter/event-title-linter.adapter";
import { TitleLinterAdapter } from "./linter/adapter/title-linter.adapter";
import { EventDescriptionLinterAdapter } from "./linter/adapter/event-description-linter.adapter";
import { HosterLinterAdapter } from "./linter/adapter/hoster-linter.adapter";
import { AgendaLinterAdapter } from "./linter/adapter/agenda-linter.adapter";
import { MeetupLinkLinterAdapter } from "./linter/adapter/meetup-link-linter.adapter";
import { DriveLinkLinterAdapter } from "./linter/adapter/drive-link-linter.adapter";
import { CNCFLinkLinterAdapter } from "./linter/adapter/cncf-link-linter.adapter";
import { LabelsLinterAdapter } from "./linter/adapter/labels-linter.adapter";

const container = new Container();

container.bind<CoreService>(CORE_SERVICE_IDENTIFIER).toConstantValue(coreService);

container.bind(GithubService).toSelf();
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
