import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';

export class VerifyCodeDto {
  @ApiProperty({ example: 'sonhador@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Código de 6 dígitos enviado por e-mail.', example: '482913' })
  @Matches(/^\d{6}$/, { message: 'O código tem 6 dígitos.' })
  code: string;
}
