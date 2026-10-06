import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangePlanDto {
  @ApiProperty({ enum: Plan, description: 'Plano para o qual o usuário quer mudar.' })
  @IsEnum(Plan, { message: 'Plano inválido.' })
  plan: Plan;
}
