import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("RequestLogger");

  private getUserId(req: Request): string {
    return (req.user as { id?: string } | undefined)?.id || "anonymous";
  }

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
      const userId = this.getUserId(req);

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${duration}ms [user=${userId}] [req=${requestId}]`,
      );
    });

    next();
  }
}
