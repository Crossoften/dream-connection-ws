import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmotionKey } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertProfileDto {
  @ApiPropertyOptional({ description: 'Como prefere ser chamado(a).' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nickname?: string;

  @ApiPropertyOptional({ description: 'Momento de vida (Tranquilo, Em transição…).' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lifeMoment?: string;

  @ApiPropertyOptional({ description: 'Profissão, estudo, ocupação.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  work?: string;

  @ApiPropertyOptional({ description: 'Como se sente no trabalho (Realizado, Sobrecarregado…).' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  workFeel?: string;

  @ApiPropertyOptional({ type: [String], description: 'Paixões e referências.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  passions?: string[];

  @ApiPropertyOptional({ type: [String], description: 'O que costuma preocupar.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fears?: string[];

  @ApiPropertyOptional({ enum: EmotionKey, description: 'Emoção que mais acompanha agora.' })
  @IsOptional()
  @IsEnum(EmotionKey)
  currentEmotion?: EmotionKey;

  @ApiPropertyOptional({ description: 'O que você busca (opcional).' })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  seeking?: string;
}
