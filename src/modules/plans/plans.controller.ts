import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChangePlanDto } from './dto/change-plan.dto';
import { PlansOverviewDto } from './dto/plans-overview.dto';
import { PlansService } from './plans.service';

@ApiTags('Planos')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @ApiOperation({
    summary: 'Planos disponíveis, plano atual e quanto falta do teste grátis.',
    description:
      'O preço vem em centavos. Plano com preço null é "a definir" e não pode ser escolhido.',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({ type: PlansOverviewDto })
  overview(@CurrentUser() user: User): Promise<PlansOverviewDto> {
    return this.plansService.overview(user.id) as Promise<PlansOverviewDto>;
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Troca o plano do usuário.',
    description:
      'Plano pago fica como pagamento pendente: ainda não há meio de pagamento integrado. Voltar para o Gratuito é imediato.',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({ type: PlansOverviewDto })
  @ApiNotFoundResponse({ description: 'Plano indisponível.' })
  @ApiUnprocessableEntityResponse({
    description: 'Já está nesse plano, ou o preço do plano ainda está a definir.',
  })
  change(@CurrentUser() user: User, @Body() body: ChangePlanDto): Promise<PlansOverviewDto> {
    return this.plansService.change(user.id, body.plan) as Promise<PlansOverviewDto>;
  }
}
