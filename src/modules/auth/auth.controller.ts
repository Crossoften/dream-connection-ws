import { Body, Controller, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { IsPublic } from './decorators/is-public.decorator';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { ResponseLoginDto } from './dto/response-login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthRequest } from './models/AuthRequest';

/** Limite das rotas de entrada: 10 tentativas por minuto por endereço. */
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60000 } };

@ApiTags('Autenticação')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @IsPublic()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @ApiOperation({ summary: 'Login por e-mail e senha.' })
  @ApiBody({ type: LoginUserDto })
  @ApiOkResponse({ type: ResponseLoginDto })
  @HttpCode(HttpStatus.OK)
  @ApiBadRequestResponse({ description: 'Requisição inválida.' })
  @ApiTooManyRequestsResponse({ description: 'Mais de 10 tentativas por minuto do mesmo endereço.' })
  @ApiInternalServerErrorResponse({ description: 'Erro interno no servidor.' })
  @UseGuards(LocalAuthGuard)
  async login(@Request() req: AuthRequest) {
    const { user } = req;

    return this.authService.login(user);
  }

  @IsPublic()
  @Throttle(AUTH_THROTTLE)
  @Post('google')
  @ApiOperation({ summary: 'Login com Google (idToken do Firebase).' })
  @ApiOkResponse({ type: ResponseLoginDto })
  @HttpCode(HttpStatus.OK)
  @ApiBadRequestResponse({ description: 'Requisição inválida.' })
  @ApiTooManyRequestsResponse({ description: 'Mais de 10 tentativas por minuto do mesmo endereço.' })
  async google(@Body() body: GoogleLoginDto) {
    return this.authService.googleLogin(body.idToken);
  }

  @IsPublic()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Cadastro de sonhador (conta ativa + sessão).' })
  @ApiCreatedResponse({ type: ResponseLoginDto })
  @ApiConflictResponse({ description: 'E-mail já em uso.' })
  @ApiBadRequestResponse({ description: 'Requisição inválida.' })
  @ApiTooManyRequestsResponse({ description: 'Mais de 10 tentativas por minuto do mesmo endereço.' })
  @ApiInternalServerErrorResponse({ description: 'Erro interno no servidor.' })
  async register(@Body() body: RegisterUserDto) {
    return this.authService.register(body);
  }
}
