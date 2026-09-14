import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CaptureMode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDreamDto {
  @ApiProperty({
    description: 'Relato do sonho, do jeito que veio.',
    minLength: 10,
    maxLength: 10000,
    example: 'Eu estava dentro de um táxi com o Matheus. No meio de uma conversa, senti um impulso de abraçá-lo.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  text: string;

  @ApiPropertyOptional({ enum: CaptureMode, default: CaptureMode.Texto, description: 'Escrito ou falado.' })
  @IsOptional()
  @IsEnum(CaptureMode)
  captureMode?: CaptureMode;

  @ApiPropertyOptional({
    description: 'Resposta a "Vai acontecer algo importante hoje?", perguntada antes do relato.',
    maxLength: 500,
    example: 'entrevista de emprego',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  eventToday?: string;
}
