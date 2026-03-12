import { IsOptional, IsString, MaxLength } from 'class-validator';

export class WaiveFineDto {
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}
