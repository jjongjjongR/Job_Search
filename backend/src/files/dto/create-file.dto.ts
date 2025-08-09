// src/files/dto/create-file.dto.ts

import { IsString } from 'class-validator';

export class CreateFileDto {
  @IsString()
  title: string;

  @IsString()
  uploader: string;
}
