import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePersonDto {
  @ApiProperty({ description: 'Nome da pessoa.' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @ApiProperty({ description: 'Relação (Mãe, Pai, Filho(a), Amigo(a)…).' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  relation: string;
}
