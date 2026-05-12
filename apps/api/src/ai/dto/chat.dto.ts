import { IsString, IsOptional, MinLength, MaxLength, IsIn, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AUTO_MODEL_ID, SELECTABLE_MODEL_IDS } from '../model-registry';

const ALLOWED_MODELS = [AUTO_MODEL_ID, ...SELECTABLE_MODEL_IDS];

export class ChatDto {
  @ApiProperty({ description: 'User message', minLength: 1, maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message: string;

  @ApiPropertyOptional({ description: 'Base64-encoded image (legacy field name)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000000)
  image?: string;

  @ApiPropertyOptional({ description: 'Base64-encoded image to include with the message' })
  @IsOptional()
  @IsString()
  @MaxLength(2000000)
  imageBase64?: string | null;

  @ApiPropertyOptional({ description: 'Legacy single-mode string' })
  @IsOptional()
  @IsString()
  mode?: string;

  @ApiPropertyOptional({ description: 'Model ID to use (auto or allowlisted model ID)', enum: ALLOWED_MODELS })
  @IsOptional()
  @IsIn(ALLOWED_MODELS)
  model?: string;

  @ApiPropertyOptional({ description: 'Whether the message includes an image' })
  @IsOptional()
  @IsBoolean()
  hasImage?: boolean;

  @ApiPropertyOptional({ description: 'Conversation ID' })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({ description: 'Manual AI mode overrides' })
  @IsOptional()
  @IsArray()
  manualModes?: string[];

  @ApiPropertyOptional({ description: 'Message history' })
  @IsOptional()
  @IsArray()
  history?: { role: string; content: string }[];
}
