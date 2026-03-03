import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReadingListDto {
  @ApiProperty({ example: 'Software Engineering Fundamentals' })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @ApiPropertyOptional({ example: 'Essential readings for SE101 course' })
  @IsOptional()
  @IsString()
  description?: string;
}
