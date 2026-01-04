import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'RETURNED' | 'OVERDUE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}