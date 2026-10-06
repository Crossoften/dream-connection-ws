import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

class TrialDto {
  @ApiProperty({ description: 'Duração do teste grátis, em dias.' })
  days: number;

  @ApiProperty({ nullable: true, description: 'Quando o teste grátis termina.' })
  endsAt: Date | null;

  @ApiProperty({ description: 'Dias que ainda faltam; 0 quando já acabou.' })
  daysLeft: number;

  @ApiProperty({ description: 'Está no gratuito e ainda dentro dos 30 dias.' })
  active: boolean;

  @ApiProperty({ description: 'Está no gratuito e o prazo já passou.' })
  expired: boolean;
}

class PlanTierDto {
  @ApiProperty({ enum: Plan })
  key: Plan;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true, description: 'Preço em centavos; null = a definir.' })
  priceCents: number | null;

  @ApiProperty()
  description: string;

  @ApiProperty({ description: 'É o plano em que o usuário está.' })
  current: boolean;

  @ApiProperty({ description: 'Pode ser escolhido — plano sem preço definido não pode.' })
  available: boolean;
}

export class PlansOverviewDto {
  @ApiProperty({ enum: Plan, description: 'Plano atual do usuário.' })
  current: Plan;

  @ApiProperty({
    description:
      'Plano pago escolhido e ainda não cobrado — não há meio de pagamento integrado.',
  })
  paymentPending: boolean;

  @ApiProperty({ type: TrialDto })
  trial: TrialDto;

  @ApiProperty({ type: [PlanTierDto] })
  tiers: PlanTierDto[];
}
