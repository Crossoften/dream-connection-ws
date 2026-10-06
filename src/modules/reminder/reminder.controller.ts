import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsPublic } from '../auth/decorators/is-public.decorator';
import { SaveReminderDto, UnsubscribeDto } from './dto/save-reminder.dto';
import { SaveSubscriptionDto } from './dto/save-subscription.dto';
import { ReminderService } from './reminder.service';

@ApiTags('Lembrete')
@Controller('reminder')
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @IsPublic()
  @Get('public-key')
  @ApiOperation({
    summary: 'Chave pública VAPID, que o navegador precisa para se inscrever.',
    description: 'Pública por definição — é ela que viaja para o navegador. Vazia se o servidor não tiver chave configurada.',
  })
  @ApiOkResponse({ description: '{ publicKey: string | null }' })
  publicKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY || null };
  }

  @Get()
  @ApiOperation({ summary: 'Lembrete do usuário: ligado, hora e aparelhos inscritos.', security: [{ bearerAuth: [] }] })
  settings(@CurrentUser() user: User) {
    return this.reminderService.settings(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Liga/desliga o lembrete e define a hora.', security: [{ bearerAuth: [] }] })
  save(@CurrentUser() user: User, @Body() body: SaveReminderDto) {
    return this.reminderService.save(user.id, body);
  }

  @Post('subscription')
  @ApiOperation({ summary: 'Registra este navegador para receber o lembrete.', security: [{ bearerAuth: [] }] })
  subscribe(@CurrentUser() user: User, @Body() body: SaveSubscriptionDto) {
    return this.reminderService.subscribe(user.id, body);
  }

  @Delete('subscription')
  @ApiOperation({ summary: 'Remove este navegador da lista de lembretes.', security: [{ bearerAuth: [] }] })
  unsubscribe(@CurrentUser() user: User, @Body() body: UnsubscribeDto) {
    return this.reminderService.unsubscribe(user.id, body.endpoint);
  }
}
