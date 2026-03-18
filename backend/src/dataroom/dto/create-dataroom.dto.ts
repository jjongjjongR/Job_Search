// backend/src/dataroom/dto/create-dataroom.dto.ts

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { IsNumber } from 'class-validator';

export class CreateDataroomDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  uploader: string;

  @IsNumber()
  fileId: number;
}
