import { Injectable, LoggerService } from '@nestjs/common';
import pino from 'pino';

@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger: pino.Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
    });
  }

  log(message: any, ...optionalParams: any[]) {
    if (typeof message === 'object' && message !== null) {
      this.logger.info(message);
    } else {
      const context = optionalParams[0];
      this.logger.info({ context }, String(message));
    }
  }

  error(message: any, ...optionalParams: any[]) {
    if (typeof message === 'object' && message !== null) {
      this.logger.error(message);
    } else {
      const context = optionalParams[0];
      const trace = optionalParams[1];
      this.logger.error({ context, trace }, String(message));
    }
  }

  warn(message: any, ...optionalParams: any[]) {
    if (typeof message === 'object' && message !== null) {
      this.logger.warn(message);
    } else {
      const context = optionalParams[0];
      this.logger.warn({ context }, String(message));
    }
  }

  debug(message: any, ...optionalParams: any[]) {
    if (typeof message === 'object' && message !== null) {
      this.logger.debug(message);
    } else {
      const context = optionalParams[0];
      this.logger.debug({ context }, String(message));
    }
  }

  info(obj: object, msg?: string) {
    this.logger.info(obj, msg);
  }
}
