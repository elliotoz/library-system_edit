import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  private getUserId(req: Request): string {
    return (req.user as { id?: string } | undefined)?.id || 'anonymous';
  }

  private getPayloadSize(data: unknown): number {
    if (typeof data === 'string') {
      return data.length;
    }

    if (data === undefined || data === null) {
      return 0;
    }

    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, body, query } = req;
    const initialUserId = this.getUserId(req);
    const logger = this.logger;
    const getPayloadSize = (data: unknown) => this.getPayloadSize(data);
    let responseSize = 0;

    // Log incoming request
    const incomingLog = {
      timestamp: new Date().toISOString(),
      direction: '→ INCOMING',
      method,
      path: originalUrl,
      userId: initialUserId,
      query: Object.keys(query).length > 0 ? query : undefined,
      bodySize: this.getPayloadSize(body),
    };

    logger.log(`${method} ${originalUrl} [${initialUserId}]`);
    logger.debug(JSON.stringify(incomingLog, null, 2));

    const originalSend = res.send;
    res.send = function (data: any) {
      responseSize = getPayloadSize(data);
      return originalSend.call(this, data);
    };

    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const statusColor = statusCode >= 400 ? '❌' : statusCode >= 300 ? '⚠️' : '✅';
      const finalUserId = this.getUserId(req);
      const contentLength = res.getHeader('content-length');
      const finalResponseSize =
        typeof contentLength === 'string'
          ? Number(contentLength)
          : typeof contentLength === 'number'
            ? contentLength
            : responseSize;

      const responseLog = {
        timestamp: new Date().toISOString(),
        direction: '← RESPONSE',
        method,
        path: originalUrl,
        userId: finalUserId,
        statusCode,
        duration: `${duration}ms`,
        responseSize: finalResponseSize,
      };

      logger.log(
        `${statusColor} ${method} ${originalUrl} [${statusCode}] (${duration}ms)`,
      );
      logger.debug(JSON.stringify(responseLog, null, 2));
    });

    next();
  }
}
