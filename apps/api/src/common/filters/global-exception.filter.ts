import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = req.requestId || "-";

    let status: number;
    let body: Record<string, unknown>;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Extract message — may be a string or a string[] from ValidationPipe.
      // Always include success: false. Never spread the full NestJS envelope
      // (statusCode, error) into the response body — HTTP status in the header
      // is the authoritative signal.
      const message =
        typeof exceptionResponse === "object" && exceptionResponse !== null
          ? (exceptionResponse as Record<string, unknown>).message
          : exceptionResponse;

      body = {
        success: false,
        message,
        requestId,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Unknown error — never leak internals
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      body = {
        success: false,
        message: "Internal server error",
        requestId,
        timestamp: new Date().toISOString(),
      };
    }

    // Server-side logging with full stack
    const stack =
      exception instanceof Error ? exception.stack : String(exception);
    this.logger.error(
      `${status} ${req.method} ${req.originalUrl} [req=${requestId}] ${stack}`,
    );

    res.status(status).json(body);
  }
}
