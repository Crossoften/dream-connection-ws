import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'sonhador@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Código de 6 dígitos enviado por e-mail.', example: '482913' })
  @Matches(/^\d{6}$/, { message: 'O código tem 6 dígitos.' })
  code: string;

  @ApiProperty({ minLength: 6, maxLength: 60 })
  @IsString()
  @MinLength(6)
  @MaxLength(60)
  password: string;

  @ApiProperty({ minLength: 6, maxLength: 60 })
  @IsString()
  @MinLength(6)
  @MaxLength(60)
  confirmPassword: string;
}
