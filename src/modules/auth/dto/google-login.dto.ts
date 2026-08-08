import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ description: 'idToken emitido pelo Firebase Auth (login Google).' })
  @IsString()
  @MinLength(20)
  idToken: string;
}
