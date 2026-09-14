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
      'Quantas perguntas ativas o sonhador já respondeu. Pergunta de seguimento só entra na conta quando se aplica (ex.: "Quantos filhos você tem?" só para quem respondeu "Sim" em "Possui filhos?"). `answered = 0` indica que a abertura da ficha ainda não foi feita.',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({
    description: 'Progresso da ficha.',
    schema: { example: { answered: 5, total: 41, completionPct: 12 } },
  })
  progress(@CurrentUser() user: User) {
    return this.dreamerService.progress(user.id);
  }

  @Get('next')
  @ApiOperation({
    summary: 'Próximo bloco da ficha (até 5 perguntas, mais as de seguimento).',
    description:
      'Abertura: 5 perguntas no primeiro acesso. Depois, mais 5 a cada 5 sonhos decodificados. Perguntas de seguimento ("Se sim, quantos?") vêm primeiro, só quando a pergunta-mãe tem a resposta que as libera, e não gastam o saldo do bloco. Categorias ligadas ao que aparece nos sonhos sobem na fila. `followUpWhen` lista as respostas que liberam uma pergunta de seguimento.',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({
    description: 'Perguntas liberadas e ainda não respondidas (lista vazia quando não há).',
    schema: {
      example: [
        {
          id: 32,
          prompt: 'Possui filhos?',
          kind: 'YesNo',
          options: null,
          category: 'familia',
          sortOrder: 4,
          dependsOnId: null,
          dependsOnAnswer: null,
          followUpWhen: ['Sim'],
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
