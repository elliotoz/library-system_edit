import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ImportBookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  authors: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ebookUrl?: string;

  @ApiProperty({ description: 'OpenLibrary or Gutendex' })
  @IsString()
  @IsNotEmpty()
  source: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  isbn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  publicationYear?: number;
}

export interface NormalizedBook {
  title: string;
  authors: string[];
  description?: string;
  coverImageUrl?: string;
  ebookUrl?: string;
  source: 'OpenLibrary' | 'Gutendex';
  isbn?: string;
  publicationYear?: number;
}
