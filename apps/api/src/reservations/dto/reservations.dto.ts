import { IsString, IsOptional, IsNotEmpty, MaxLength, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReservationDto {
  @ApiProperty()
  @IsString()
  bookId: string;

  @ApiProperty()
  @IsString()
  branchId: string;
}

export class RejectReservationDto {
  @ApiProperty({
    description: 'Reason for rejecting the reservation',
    example: 'Book is damaged and unavailable for lending.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  reason: string;
}

export class ReservationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'APPROVED' | 'READY_FOR_PICKUP' | 'COLLECTED' | 'CANCELLED' | 'EXPIRED';

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