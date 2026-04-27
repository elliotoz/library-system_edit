import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  emailNotifications?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  dueDateReminders?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  reservationAlerts?: boolean;
}
