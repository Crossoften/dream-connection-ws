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
    summary: 'Registra um sonho e extrai os elementos centrais, em ordem de relevância.',
    description:
      'Até 8 elementos (substantivos, verbos, adjetivos e pronomes), sem repetição. Pessoas vêm marcadas (`isPerson`); símbolos já conhecidos vêm pré-preenchidos com o significado e a emoção do dicionário pessoal (`fromDictionary`).',
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
  @ApiOkResponse({ description: 'Sonho com elementos e decodificação.' })
  findOne(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.dreamsService.findOwned(user.id, id);
  }

  @Put(':id/elements')
  @ApiOperation({
    summary: 'Atualiza as atribuições dos elementos: significado, emoção e tempo.',
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
    summary: 'Decodifica o sonho via IA.',
    description:
      'Devolve o sonho com `insight`: emoção principal e secundária, movimento emocional identificado (`movement`), estado emocional predominante (`emotionalState`), a mensagem emocional do sonho (`message`) e a mensagem final ao sonhador (`finalMessage`). Atualiza o dicionário pessoal e a sequência de noites. Chamar de novo devolve a decodificação já gerada.',
    security: [{ bearerAuth: [] }],
  })
  @ApiCreatedResponse({ description: 'Decodificação gerada e persistida.' })
  @ApiBadRequestResponse({ description: 'Nenhuma emoção associada aos elementos.' })
  generateInsight(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.dreamsService.generateInsight(user.id, id);
  }
}
