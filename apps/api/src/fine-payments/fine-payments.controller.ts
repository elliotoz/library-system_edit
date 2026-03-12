import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FinePaymentsService } from './fine-payments.service';
import { WaiveFineDto } from './dto/fine-payments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, FineStatus } from '@prisma/client';

@Controller('fine-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class FinePaymentsController {
  constructor(private readonly finePaymentsService: FinePaymentsService) {}

  @Get()
  findAll(
    @Query('status') status?: FineStatus,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.finePaymentsService.findAll({
      status,
      userId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('totals')
  getTotals() {
    return this.finePaymentsService.getTotals();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.finePaymentsService.findById(id);
  }

  @Patch(':id/pay')
  markPaid(@Param('id') id: string, @CurrentUser() user: any) {
    return this.finePaymentsService.markPaid(id, user.id);
  }

  @Patch(':id/waive')
  waive(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: WaiveFineDto,
  ) {
    return this.finePaymentsService.waive(id, user.id, dto.note);
  }
}
