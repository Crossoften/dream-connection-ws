import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ImessageEntity } from '@interfaces/entities/Imessage.entity';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsPublic } from '../auth/decorators/is-public.decorator';
import { NewContactDto } from '../mail/dto/new-contact.dto';
import { ForgotDto } from './dto/forgot.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResponseMySelfDto } from './dto/response-my-self.dto';
import { ResponseTextDto } from './dto/response-text.dto';
import { TextQueriesDto } from './dto/text-queries.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { NoAuthService } from './no-auth.service';

/** Limite da recuperação de senha: 5 chamadas por minuto por endereço. */
const RECOVERY_THROTTLE = { default: { limit: 5, ttl: 60000 } };

@Controller()
export class NoAuthController {
  constructor(private readonly noAuthService: NoAuthService) {}

  @IsPublic()
  @Throttle(RECOVERY_THROTTLE)
  @Post('no-auth/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Sem autenticação')
  @ApiOperation({
    summary: 'Envia o código de redefinição de senha por e-mail.',
    description:
      'Código de 6 dígitos, válido por 1 hora. A resposta é a mesma exista ou não a conta, para não revelar quais e-mails estão cadastrados.',
  })
  @ApiOkResponse({ type: ImessageEntity })
  @ApiBadRequestResponse({ description: 'E-mail em formato inválido.' })
  @ApiTooManyRequestsResponse({ description: 'Mais de 5 chamadas por minuto do mesmo endereço.' })
  async forgot(@Body() body: ForgotDto): Promise<ImessageEntity> {
    await this.noAuthService.forgot(body.email);
    return { message: 'Se houver uma conta com este e-mail, enviamos um código para ele.' };
  }

  @IsPublic()
  @Throttle(RECOVERY_THROTTLE)
  @Post('no-auth/verify-code')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Sem autenticação')
  @ApiOperation({
    summary: 'Confere o código de redefinição (e-mail + código).',
    description: 'Código errado é invalidado na hora: uma tentativa por código.',
  })
  @ApiOkResponse({ type: ImessageEntity })
  @ApiBadRequestResponse({ description: 'Código inválido — é preciso solicitar um novo.' })
  @ApiUnprocessableEntityResponse({ description: 'Código expirado — é preciso solicitar um novo.' })
  @ApiTooManyRequestsResponse({ description: 'Mais de 5 chamadas por minuto do mesmo endereço.' })
  async verifyCode(@Body() body: VerifyCodeDto): Promise<ImessageEntity> {
    await this.noAuthService.verifyCode(body);
    return { message: 'Código verificado com sucesso!' };
  }

  @IsPublic()
  @Throttle(RECOVERY_THROTTLE)
  @Post('no-auth/reset')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Sem autenticação')
  @ApiOperation({ summary: 'Redefine a senha (e-mail + código + nova senha).' })
  @ApiOkResponse({ type: ImessageEntity })
  @ApiBadRequestResponse({ description: 'Código inválido ou senhas diferentes.' })
  @ApiUnprocessableEntityResponse({ description: 'Código expirado — é preciso solicitar um novo.' })
  @ApiTooManyRequestsResponse({ description: 'Mais de 5 chamadas por minuto do mesmo endereço.' })
  async reset(@Body() body: ResetPasswordDto): Promise<ImessageEntity> {
    await this.noAuthService.reset(body);
    return { message: 'Senha redefinida com sucesso.' };
  }

  @IsPublic()
  @Post('no-auth/contact-us')
  @ApiTags('Sem autenticação')
  @ApiOperation({ summary: 'Fale conosco.' })
  @ApiOkResponse({ type: ImessageEntity })
  @ApiBadRequestResponse({ description: 'Requisição inválida' })
  @ApiInternalServerErrorResponse({ description: 'Erro interno no servidor.' })
  async contactUs(@Body() body: NewContactDto): Promise<ImessageEntity> {
    await this.noAuthService.contactUs(body);
    return { message: 'Contato enviado com sucesso, em breve retornaremos.' };
  }

  @IsPublic()
  @Get('no-auth/texts')
  @ApiTags('Sem autenticação')
  @ApiOperation({ summary: 'Textos institucionais (termos, política, sobre).' })
  @ApiOkResponse({ type: ResponseTextDto })
  @ApiBadRequestResponse({ description: 'Requisição inválida' })
  @ApiInternalServerErrorResponse({ description: 'Erro interno no servidor.' })
  texts(@Query() query: TextQueriesDto): Promise<ResponseTextDto> {
    return this.noAuthService.texts(query);
  }

  @IsPublic()
  @Get('no-auth/health-check')
  @ApiTags('Sem autenticação')
  @ApiOperation({ summary: 'Status do servidor.' })
  @ApiOkResponse({ description: 'Servidor UP' })
  healthCheck() {
    return { message: 'Servidor UP' };
  }

  @Get('my-self')
  @ApiTags('My Self')
  @ApiOperation({
    summary: 'Dados do usuário logado.',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({ type: ResponseMySelfDto })
  @ApiBadRequestResponse({ description: 'Requisição inválida' })
  @ApiInternalServerErrorResponse({ description: 'Erro interno no servidor.' })
  mySelf(@CurrentUser() user: User) {
    return this.noAuthService.mySelf(user.id);
  }
}
