import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanCoverDto {
  @ApiProperty({ description: 'Base64-encoded image (compressed client-side)' })
  @IsString()
  @MaxLength(2000000)
  image: string;
}
