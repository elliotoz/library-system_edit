import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsEnum,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BorrowStatus, Role } from '@prisma/client';

export class CreateBorrowDto {
  @ApiProperty()
  @IsString()
  bookCopyId: string;

  @ApiProperty()
  @IsString()
  userId: string;
}

export class ExtendBorrowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  newDueDate?: string;
}

export class BorrowQueryDto {
  @ApiPropertyOptional({ enum: BorrowStatus })
  @IsOptional()
  @IsEnum(BorrowStatus)
  status?: BorrowStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

// BorrowHistoryQueryDto: status and role accept 'all' (service filters on !== 'all')
export class BorrowHistoryQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bookId?: string;

  @ApiPropertyOptional({ description: "Role name or 'all'" })
  @IsOptional()
  @IsIn(['all', ...Object.values(Role)])
  role?: string;

  @ApiPropertyOptional({ description: "BorrowStatus or 'all'" })
  @IsOptional()
  @IsIn(['all', ...Object.values(BorrowStatus)])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class MostBorrowedQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class TrendsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}
