// src/post/comment/comment.controller.ts

import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  async create(@Body() dto: CreateCommentDto): Promise<Comment> {
    return await this.commentService.create(dto);
  }

  // @Get()
  // async findAll(): Promise<Comment[]> {
  //   return await this.commentService.findAll();
  // }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Comment> {
    return await this.commentService.findOne(Number(id));
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<Comment> {
    return await this.commentService.update(Number(id), dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<string> {
    await this.commentService.remove(Number(id));
    return `Comment with ID ${id} deleted successfully`;
  }

  @Get()
  async findByPostId(@Query('postId') postId: string): Promise<Comment[]> {
    const postIdNum = Number(postId);
    if (isNaN(postIdNum)) {
      throw new BadRequestException('Invalid postId');
    }
    return await this.commentService.findByPostId(postIdNum);
  }
}
