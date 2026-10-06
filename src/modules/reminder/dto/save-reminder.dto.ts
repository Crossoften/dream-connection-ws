import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

export class SaveReminderDto {
  @ApiProperty({ description: 'Liga ou desliga o lembrete.' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Hora do lembrete, HH:mm, no fuso do usuário.', example: '07:00' })
  @ValidateIf((dto: SaveReminderDto) => dto.enabled)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora inválida: use HH:mm.' })
  time?: string;

  @ApiPropertyOptional({ description: 'Fuso IANA do usuário.', example: 'America/Sao_Paulo' })
  @ValidateIf((dto: SaveReminderDto) => dto.enabled)
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class UnsubscribeDto {
  @ApiProperty({ description: 'Endpoint da inscrição que será removida.' })
  @IsString()
  @MaxLength(500)
  endpoint: string;
}
