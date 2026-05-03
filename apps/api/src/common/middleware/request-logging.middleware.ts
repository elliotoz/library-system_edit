import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, body, query, params, user } = req;
    const userId = (user as any)?.id || 'anonymous';

    // Log incoming request
    const incomingLog = {
      timestamp: new Date().toISOString(),
      direction: '→ INCOMING',
      method,
      path: originalUrl,
      userId,
      query: Object.keys(query).length > 0 ? query : undefined,
      bodySize: JSON.stringify(body).length,
    };

    this.logger.log(`${method} ${originalUrl} [${userId}]`);
    this.logger.debug(JSON.stringify(incomingLog, null, 2));

    // Capture response
    const originalSend = res.send;
    res.send = function (data: any) {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const statusColor = statusCode >= 400 ? '❌' : statusCode >= 300 ? '⚠️' : '✅';

      const responseLog = {
        timestamp: new Date().toISOString(),
        direction: '← RESPONSE',
        method,
        path: originalUrl,
        userId,
        statusCode,
        duration: `${duration}ms`,
        responseSize: typeof data === 'string' ? data.length : JSON.stringify(data).length,
      };

      this.logger.log(
        `${statusColor} ${method} ${originalUrl} [${statusCode}] (${duration}ms)`,
      );
      this.logger.debug(JSON.stringify(responseLog, null, 2));

      return originalSend.call(this, data);
    };

    next();
  }
}
