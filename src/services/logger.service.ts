import { inject, injectable } from "inversify";
import { CORE_SERVICE_IDENTIFIER, type CoreService } from "./core.service.js";

@injectable()
export class LoggerService {
  constructor(@inject(CORE_SERVICE_IDENTIFIER) private readonly coreService: CoreService) {}

  warn(message: string): void {
    this.coreService.warning(message);
  }

  info(message: string): void {
    this.coreService.info(message);
  }

  debug(message: string) {
    this.coreService.debug(message);
  }
}
