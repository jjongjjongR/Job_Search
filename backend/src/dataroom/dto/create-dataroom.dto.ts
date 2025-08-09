// backend/src/dataroom/dto/create-dataroom.dto.ts

import { IsString, IsNotEmpty } from 'class-validator';

export class CreateDataroomDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  uploader: string;
}
