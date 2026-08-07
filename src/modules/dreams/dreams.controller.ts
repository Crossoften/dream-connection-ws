import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DreamsService } from './dreams.service';
import { CreateDreamDto } from './dto/create-dream.dto';
import { UpdateElementsDto } from './dto/update-elements.dto';

@ApiTags('Sonhos')
@Controller('dreams')
export class DreamsController {
  constructor(private readonly dreamsService: DreamsService) {}

  @Post()
  @ApiOperation({
    summary: 'Registra um sonho e extrai os elementos centrais (com pré-preenchimento do dicionário).',
    security: [{ bearerAuth: [] }],
  })
  @ApiCreatedResponse({ description: 'Sonho registrado com elementos extraídos.' })
  @ApiBadRequestResponse({ description: 'Requisição inválida.' })
  @ApiInternalServerErrorResponse({ description: 'Erro interno no servidor.' })
  create(@CurrentUser() user: User, @Body() body: CreateDreamDto) {
    return this.dreamsService.create(user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Lista o diário de sonhos do usuário.', security: [{ bearerAuth: [] }] })
  @ApiOkResponse({ description: 'Sonhos do usuário, do mais recente para o mais antigo.' })
  findAll(@CurrentUser() user: User) {
    return this.dreamsService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Recupera um sonho específico.', security: [{ bearerAuth: [] }] })
  @ApiOkResponse({ description: 'Sonho com elementos e insight.' })
  findOne(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.dreamsService.findOwned(user.id, id);
  }

  @Put(':id/elements')
  @ApiOperation({
    summary: 'Atualiza as atribuições de significado/emoção dos elementos do sonho.',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({ description: 'Elementos atualizados.' })
  @ApiBadRequestResponse({ description: 'Requisição inválida.' })
  updateElements(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateElementsDto,
  ) {
    return this.dreamsService.updateElements(user.id, id, body);
  }

  @Post(':id/insight')
  @ApiOperation({
    summary: 'Gera o insight do sonho via IA (atualiza dicionário pessoal e streak).',
    security: [{ bearerAuth: [] }],
  })
  @ApiCreatedResponse({ description: 'Insight gerado e persistido.' })
  @ApiBadRequestResponse({ description: 'Nenhuma emoção associada aos elementos.' })
  generateInsight(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.dreamsService.generateInsight(user.id, id);
  }
}
