import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JourneyService } from './journey.service';

@ApiTags('Jornada')
@Controller('journey')
export class JourneyController {
  constructor(private readonly journeyService: JourneyService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Painel emocional: emoção do mês, últimos 7 dias, distribuição e símbolos recorrentes.',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({ description: 'Dados agregados da jornada do usuário.' })
  dashboard(@CurrentUser() user: User) {
    return this.journeyService.dashboard(user.id);
  }
}
