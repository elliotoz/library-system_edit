import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReservationDto {
  @ApiProperty()
  @IsString()
  bookId: string;

  @ApiProperty()
  @IsString()
  branchId: string;
}

export class ReservationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'READY_FOR_PICKUP' | 'COLLECTED' | 'CANCELLED' | 'EXPIRED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}