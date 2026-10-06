import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/** O que o `PushSubscription` do navegador entrega, achatado. */
export class SaveSubscriptionDto {
  @ApiProperty({ description: 'Endereço do serviço de push do navegador.' })
  @IsString()
  @MaxLength(500)
  endpoint: string;

  @ApiProperty({ description: 'Chave pública da inscrição.' })
  @IsString()
  @MaxLength(200)
  p256dh: string;

  @ApiProperty({ description: 'Segredo de autenticação da inscrição.' })
  @IsString()
  @MaxLength(100)
  auth: string;
}
