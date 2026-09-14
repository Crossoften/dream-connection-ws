import { ApiProperty } from '@nestjs/swagger';
import { Role, Status } from '@prisma/client';

export class ResponseAllUserDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ enum: Role })
  role: string;

  @ApiProperty({ enum: Status })
  status: string;

  @ApiProperty()
  fileUrl: string;

  @ApiProperty()
  fileKey: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
