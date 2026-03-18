// src/post/comment/dto/create-comment.dto.ts

import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateCommentDto {
  @IsNumber()
  postId: number;

  @IsString()
  @IsOptional()
  author: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
