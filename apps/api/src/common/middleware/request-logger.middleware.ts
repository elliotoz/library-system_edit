import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  private getUserId(req: Request): string {
    return (req.user as { id?: string } | undefined)?.id || "anonymous";
  }

  private parseContentLength(value: string | number | string[] | undefined): number | undefined {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private compactLog<T extends Record<string, unknown>>(payload: T): T {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    ) as T;
  }

  private writeLog(statusCode: number, payload: Record<string, unknown>): void {
    const message = JSON.stringify(payload);

    if (statusCode >= 500) {
      this.logger.error(message);
      return;
    }

    if (statusCode >= 400) {
      this.logger.warn(message);
      return;
    }

    this.logger.log(message);
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (process.env.ENABLE_REQUEST_LOGGING === "false") {
      return next();
    }

    if (req.originalUrl.startsWith("/uploads/")) {
      return next();
    }

    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number((process.hrtime.bigint() - startedAt) / BigInt(1_000_000));
      const statusCode = res.statusCode;
      const responseSize = this.parseContentLength(
        res.getHeader("content-length") as string | number | undefined,
      );
      const requestSize = this.parseContentLength(req.headers["content-length"]);

      this.writeLog(
        statusCode,
        this.compactLog({
          event: "http.request.completed",
          service: "library-api",
          requestId: req.requestId || "-",
          method: req.method,
          path: req.originalUrl.split("?")[0],
          userId: this.getUserId(req),
          statusCode,
          durationMs,
          requestSize,
          responseSize,
        }),
      );
    });

    next();
  }
}
