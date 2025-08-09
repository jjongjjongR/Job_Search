// src/post/comment/dto/create-comment.dto.ts

import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateCommentDto {
  @IsNumber()
  postId: number;

  @IsString()
  @IsNotEmpty()
  author: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
