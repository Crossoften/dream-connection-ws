import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NpsService } from './nps.service';

export class CreateNpsDto {
  @ApiProperty({ description: 'Nota de 1 a 5 estrelas.', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiPropertyOptional({ description: 'O que poderia melhorar?' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

@ApiTags('Pesquisa de satisfação')
@Controller('nps')
export class NpsController {
  constructor(private readonly npsService: NpsService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Indica se a caixinha de avaliação deve ser exibida (a cada 5 sonhos, enquanto não respondida).',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({ description: '{ shouldAsk: boolean }' })
  status(@CurrentUser() user: User) {
    return this.npsService.status(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Registra a avaliação do usuário.', security: [{ bearerAuth: [] }] })
  @ApiCreatedResponse({ description: 'Avaliação registrada.' })
  create(@CurrentUser() user: User, @Body() body: CreateNpsDto) {
    return this.npsService.create(user.id, body.score, body.comment);
  }
}
