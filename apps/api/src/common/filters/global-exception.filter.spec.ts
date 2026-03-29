import { ArgumentsHost, BadRequestException } from "@nestjs/common";
import { GlobalExceptionFilter } from "./global-exception.filter";
import { createResponseMock } from "../../test-utils/create-response-mock";

describe("GlobalExceptionFilter", () => {
  it("returns the standardized error envelope for HttpException", () => {
    const filter = new GlobalExceptionFilter();
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
  });

  it("preserves validation message arrays", () => {
    const filter = new GlobalExceptionFilter();
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
  });
});
