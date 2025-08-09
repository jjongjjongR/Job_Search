// src/post/post.controller.ts

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Put,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { Post as PostEntity } from './entities/post.entity';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  async create(@Body() createPostDto: CreatePostDto): Promise<PostEntity> {
    return await this.postService.create(createPostDto);
  }

  @Get()
  async findAll(): Promise<PostEntity[]> {
    return await this.postService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PostEntity> {
    return await this.postService.findOne(Number(id));
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<string> {
    await this.postService.remove(Number(id)); // eslint 오류 방지
    return `Post with ID ${id} deleted successfully`;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
  ): Promise<PostEntity> {
    return await this.postService.update(Number(id), updatePostDto);
  }
}
