import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CaptureMode, Timeframe } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDreamDto {
  @ApiProperty({ description: 'Relato do sonho, do jeito que veio.', minLength: 10 })
  @IsString()
  @MinLength(10)
  text: string;

  @ApiPropertyOptional({ enum: CaptureMode, default: CaptureMode.Texto })
  @IsOptional()
  @IsEnum(CaptureMode)
  captureMode?: CaptureMode;

  @ApiPropertyOptional({ description: 'Vai acontecer algo importante hoje?', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  eventToday?: string;

  @ApiPropertyOptional({ enum: Timeframe, description: 'Este sonho fala mais do…' })
  @IsOptional()
  @IsEnum(Timeframe)
  timeframe?: Timeframe;
}
