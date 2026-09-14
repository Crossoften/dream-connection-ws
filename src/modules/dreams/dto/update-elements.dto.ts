import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmotionKey, Timeframe } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class UpdateElementDto {
  @ApiProperty({ description: 'Id do elemento do sonho.', example: 12 })
  @IsInt()
  id: number;

  @ApiPropertyOptional({ description: 'O que este elemento representa para o sonhador.', example: 'Proteção' })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  meaning?: string;

  @ApiPropertyOptional({ enum: EmotionKey, description: 'Emoção associada (uma das 12).', example: 'Confianca' })
  @IsOptional()
  @IsEnum(EmotionKey)
  emotionKey?: EmotionKey;

  @ApiPropertyOptional({
    enum: Timeframe,
    nullable: true,
    description: 'Se o elemento fala do passado, do presente ou do futuro. Envie null para desmarcar.',
    example: 'Passado',
  })
  @IsOptional()
  @IsEnum(Timeframe)
  timeframe?: Timeframe | null;
}

export class UpdateElementsDto {
  @ApiProperty({ type: [UpdateElementDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateElementDto)
  elements: UpdateElementDto[];
}
