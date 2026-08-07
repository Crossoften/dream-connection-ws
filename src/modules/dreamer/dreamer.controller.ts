import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DreamerService } from './dreamer.service';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { CreatePersonDto } from './dto/person.dto';
import { AnswerQuestionsDto } from './dto/answer-questions.dto';

@ApiTags('Ficha anamnéstica')
@Controller('dreamer')
export class DreamerController {
  constructor(private readonly dreamerService: DreamerService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Recupera a ficha anamnéstica, pessoas do círculo e progresso.',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({ description: 'Ficha do usuário.' })
  getProfile(@CurrentUser() user: User) {
    return this.dreamerService.getProfile(user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Cria/atualiza a ficha anamnéstica.', security: [{ bearerAuth: [] }] })
  @ApiOkResponse({ description: 'Ficha atualizada.' })
  @ApiBadRequestResponse({ description: 'Requisição inválida.' })
  upsertProfile(@CurrentUser() user: User, @Body() body: UpsertProfileDto) {
    return this.dreamerService.upsertProfile(user.id, body);
  }

  @Post('people')
  @ApiOperation({ summary: 'Adiciona uma pessoa ao círculo.', security: [{ bearerAuth: [] }] })
  @ApiCreatedResponse({ description: 'Pessoa adicionada.' })
  addPerson(@CurrentUser() user: User, @Body() body: CreatePersonDto) {
    return this.dreamerService.addPerson(user.id, body);
  }

  @Delete('people/:id')
  @ApiOperation({ summary: 'Remove uma pessoa do círculo.', security: [{ bearerAuth: [] }] })
  @ApiOkResponse({ description: 'Pessoa removida.' })
  removePerson(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.dreamerService.removePerson(user.id, id);
  }

  @Get('anamnesis/next')
  @ApiOperation({
    summary: 'Próximo bloco de perguntas da anamnese contínua (5 por vez).',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({ description: 'Perguntas pendentes.' })
  nextQuestions(@CurrentUser() user: User) {
    return this.dreamerService.nextQuestions(user.id);
  }

  @Post('anamnesis/answers')
  @ApiOperation({
    summary: 'Registra respostas da anamnese contínua.',
    security: [{ bearerAuth: [] }],
  })
  @ApiCreatedResponse({ description: 'Respostas registradas; devolve o próximo bloco.' })
  answerQuestions(@CurrentUser() user: User, @Body() body: AnswerQuestionsDto) {
    return this.dreamerService.answerQuestions(user.id, body);
  }
}
