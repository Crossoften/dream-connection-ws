import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';
import { ResponseAllUserDto } from '../../admin/admin-settings/dto/response-all-user.dto';

export class ResponseMySelfDto extends ResponseAllUserDto {
  @ApiProperty({ enum: Plan })
  plan: string;

  @ApiProperty({
    nullable: true,
    description: 'Fim dos 30 dias de teste grátis, contados do cadastro.',
  })
  trialEndsAt: Date | null;

  @ApiProperty({ description: 'Noites seguidas com sonho decodificado; zera quando passa um dia sem registro.' })
  streakDays: number;

  @ApiProperty({ description: 'Total de sonhos decodificados.' })
  dreamsTotal: number;
}
