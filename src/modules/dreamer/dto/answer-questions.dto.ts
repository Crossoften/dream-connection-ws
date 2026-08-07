import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, MaxLength, ValidateNested } from 'class-validator';

export class AnswerDto {
  @ApiProperty({ description: 'Id da pergunta da anamnese.' })
  @IsInt()
  questionId: number;

  @ApiProperty({ description: 'Resposta do usuário.' })
  @IsString()
  @MaxLength(1000)
  answer: string;
}

export class AnswerQuestionsDto {
  @ApiProperty({ type: [AnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
