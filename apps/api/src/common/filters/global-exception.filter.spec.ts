import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { GlobalExceptionFilter } from "./global-exception.filter";
import { createResponseMock } from "../../test-utils/create-response-mock";

describe("GlobalExceptionFilter", () => {
  it("returns the standardized error envelope for HttpException", () => {
    const filter = new GlobalExceptionFilter();
    const warnSpy = jest
      .spyOn((filter as any).logger, "warn")
      .mockImplementation(() => undefined);
    const response = createResponseMock();
    const request = {
      requestId: "req-123",
      method: "POST",
      originalUrl: "/auth/login",
    };

    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ArgumentsHost;

    filter.catch(new BadRequestException("Bad input"), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Bad input",
        requestId: "req-123",
        timestamp: expect.any(String),
      }),
    );
    expect(response.json).not.toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: expect.anything(),
      }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "400 POST /auth/login [req=req-123] Bad input",
    );
    warnSpy.mockRestore();
  });

  it("preserves validation message arrays", () => {
    const filter = new GlobalExceptionFilter();
    const warnSpy = jest
      .spyOn((filter as any).logger, "warn")
      .mockImplementation(() => undefined);
    const response = createResponseMock();
    const request = {
      requestId: "req-456",
      method: "POST",
      originalUrl: "/reservations",
    };

    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ArgumentsHost;

    filter.catch(
      new BadRequestException({
        message: ["bookId must be a string", "branchId must be a string"],
      }),
      host,
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: ["bookId must be a string", "branchId must be a string"],
      }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "400 POST /reservations [req=req-456] bookId must be a string,branchId must be a string",
    );
    warnSpy.mockRestore();
  });

  it("logs server errors with stack context", () => {
    const filter = new GlobalExceptionFilter();
    const errorSpy = jest
      .spyOn((filter as any).logger, "error")
      .mockImplementation(() => undefined);
    const response = createResponseMock();
    const request = {
      requestId: "req-789",
      method: "GET",
      originalUrl: "/reports/export",
    };

    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ArgumentsHost;

    filter.catch(new InternalServerErrorException("Report failed"), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("500 GET /reports/export [req=req-789]"),
    );
    errorSpy.mockRestore();
  });
});
