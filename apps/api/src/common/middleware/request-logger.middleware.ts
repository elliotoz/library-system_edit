import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("RequestLogger");

  use(req: Request, res: Response, next: NextFunction) {
    if (process.env.ENABLE_REQUEST_LOGGING === "false") {
      return next();
    }

    // Skip static upload paths to reduce noise
    if (req.originalUrl.startsWith("/uploads/")) {
      return next();
    }

    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const { method, originalUrl } = req;
      const { statusCode } = res;
      const requestId = req.requestId || "-";

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${duration}ms [req=${requestId}]`,
      );
    });

    next();
  }
}
