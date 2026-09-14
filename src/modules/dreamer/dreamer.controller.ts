import { Body, Controller, Get, Post } from '@nestjs/common';
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
import { AnswerQuestionsDto } from './dto/answer-questions.dto';

@ApiTags('Ficha anamnéstica')
@Controller('dreamer/anamnesis')
export class DreamerController {
  constructor(private readonly dreamerService: DreamerService) {}

  @Get('progress')
  @ApiOperation({
    summary: 'Progresso da ficha anamnéstica.',
    description:
      'Quantas perguntas ativas o sonhador já respondeu. `answered = 0` indica que a abertura da ficha ainda não foi feita.',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({
    description: 'Progresso da ficha.',
    schema: { example: { answered: 5, total: 31, completionPct: 16 } },
  })
  progress(@CurrentUser() user: User) {
    return this.dreamerService.progress(user.id);
  }

  @Get('next')
  @ApiOperation({
    summary: 'Próximo bloco da ficha (até 5 perguntas).',
    description:
      'Abertura: 5 perguntas no primeiro acesso. Depois, mais 5 a cada 5 sonhos decodificados. Perguntas encadeadas só aparecem quando a pergunta-mãe foi respondida com o valor esperado; categorias ligadas ao que aparece nos sonhos sobem na fila.',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({
    description: 'Perguntas liberadas e ainda não respondidas (lista vazia quando não há).',
    schema: {
      example: [
        {
          id: 31,
          prompt: 'Qual é o seu estado civil?',
          kind: 'Choice',
          options: ['Solteiro(a)', 'Casado(a)', 'União estável', 'Separado(a) ou divorciado(a)', 'Viúvo(a)'],
          category: 'afetivo',
          sortOrder: 0,
          dependsOnId: null,
          dependsOnAnswer: null,
        },
      ],
    },
  })
  nextQuestions(@CurrentUser() user: User) {
    return this.dreamerService.nextQuestions(user.id);
  }

  @Post('answers')
  @ApiOperation({
    summary: 'Registra respostas da ficha.',
    description: 'Respostas em branco são ignoradas. Responder de novo a mesma pergunta atualiza a resposta.',
    security: [{ bearerAuth: [] }],
  })
  @ApiCreatedResponse({ description: 'Respostas registradas; devolve o próximo bloco liberado.' })
  @ApiBadRequestResponse({ description: 'Corpo inválido (questionId ausente ou resposta acima de 1000 caracteres).' })
  answerQuestions(@CurrentUser() user: User, @Body() body: AnswerQuestionsDto) {
    return this.dreamerService.answerQuestions(user.id, body);
  }
}
