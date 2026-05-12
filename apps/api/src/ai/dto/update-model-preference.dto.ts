import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AUTO_MODEL_ID, SELECTABLE_MODEL_IDS } from '../model-registry';

const ALLOWED_MODELS = [AUTO_MODEL_ID, ...SELECTABLE_MODEL_IDS];

export class UpdateModelPreferenceDto {
  @ApiProperty({ description: 'Model ID or "auto" to clear manual preference', enum: ALLOWED_MODELS })
  @IsIn(ALLOWED_MODELS)
  model: string;
}
