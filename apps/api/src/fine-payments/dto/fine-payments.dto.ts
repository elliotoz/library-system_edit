import { IsOptional, IsString, MaxLength, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FineStatus } from '@prisma/client';

export class WaiveFineDto {
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}

export class FinePaymentsQueryDto {
  @ApiPropertyOptional({ enum: FineStatus })
  @IsOptional()
  @IsEnum(FineStatus)
  status?: FineStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
