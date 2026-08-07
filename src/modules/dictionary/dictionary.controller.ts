import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DictionaryService } from './dictionary.service';

@ApiTags('Dicionário pessoal')
@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista o dicionário simbólico individual (com busca opcional).',
    security: [{ bearerAuth: [] }],
  })
  @ApiOkResponse({ description: 'Símbolos do usuário.' })
  findAll(@CurrentUser() user: User, @Query('query') query?: string) {
    return this.dictionaryService.findAll(user.id, query);
  }
}
