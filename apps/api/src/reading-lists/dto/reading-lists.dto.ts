import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ReadingListVisibility, ReadingListStatus } from '@prisma/client';

export class CreateReadingListDto {
  @ApiProperty({ example: 'Software Engineering Fundamentals' })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @ApiPropertyOptional({ example: 'Essential readings for SE101 course' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'SE101' })
  @IsOptional()
  @IsString()
  courseCode?: string;

  @ApiPropertyOptional({ example: '2025-2026 Spring' })
  @IsOptional()
  @IsString()
  semester?: string;

  @ApiPropertyOptional({ enum: ReadingListVisibility, example: 'PUBLIC' })
  @IsOptional()
  @IsEnum(ReadingListVisibility)
  visibility?: ReadingListVisibility;
}

export class UpdateReadingListDto {
  @ApiPropertyOptional({ example: 'Updated Reading List Title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'SE102' })
  @IsOptional()
  @IsString()
  courseCode?: string;

  @ApiPropertyOptional({ example: '2025-2026 Fall' })
  @IsOptional()
  @IsString()
  semester?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ReadingListVisibility, example: 'FOLLOWERS_ONLY' })
  @IsOptional()
  @IsEnum(ReadingListVisibility)
  visibility?: ReadingListVisibility;

  @ApiPropertyOptional({ enum: ReadingListStatus, example: 'PUBLISHED' })
  @IsOptional()
  @IsEnum(ReadingListStatus)
  status?: ReadingListStatus;
}

export class AddReadingListItemDto {
  @ApiProperty({ example: 'clxxxxxxxxxxxxxxxxx' })
  @IsString()
  @IsNotEmpty({ message: 'Book ID is required' })
  bookId: string;

  @ApiPropertyOptional({ example: 'Chapter 1-5 recommended' })
  @IsOptional()
  @IsString()
  notes?: string;
}
