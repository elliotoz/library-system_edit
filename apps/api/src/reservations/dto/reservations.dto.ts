import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
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
  status?: 'PENDING' | 'READY_FOR_PICKUP' | 'COLLECTED' | 'CANCELLED' | 'EXPIRED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}