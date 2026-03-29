import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateInterestsDto {
  @ApiProperty({ type: [String], description: 'List of interest keywords' })
  @IsArray()
  @IsString({ each: true })
  interests: string[];
}
