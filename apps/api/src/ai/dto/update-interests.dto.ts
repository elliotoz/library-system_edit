import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAiInterestsDto {
  @ApiProperty({
    description: 'List of interest topics',
    example: ['finance', 'technology', 'history'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  interests: string[];
}
