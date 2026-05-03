import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  live() {
    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe — checks DB and optional deps" })
  async ready(@Res({ passthrough: true }) res: Response) {
    const checks: Record<string, string> = {};
    let allUp = true;

    // DB check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.db = "up";
    } catch {
      checks.db = "down";
      allUp = false;
    }

    // OpenRouter AI check
    const hasOpenRouterKey = !!this.config.get("OPENROUTER_API_KEY");
    checks.ai = hasOpenRouterKey ? "configured" : "not configured";

    const status = allUp ? "ready" : "degraded";
    const httpStatus = allUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    res.status(httpStatus);

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
