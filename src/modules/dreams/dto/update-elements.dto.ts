import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmotionKey } from '@prisma/client';
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
  @ApiProperty({ description: 'Id do elemento do sonho.' })
  @IsInt()
  id: number;

  @ApiPropertyOptional({ description: 'O que este elemento representa para o sonhador.' })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  meaning?: string;

  @ApiPropertyOptional({ enum: EmotionKey, description: 'Emoção associada (uma das 12).' })
  @IsOptional()
  @IsEnum(EmotionKey)
  emotionKey?: EmotionKey;
}

export class UpdateElementsDto {
  @ApiProperty({ type: [UpdateElementDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateElementDto)
  elements: UpdateElementDto[];
}
