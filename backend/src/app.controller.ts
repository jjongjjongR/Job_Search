//src/app.controller.ts

import { Controller, Get, Post, Body } from '@nestjs/common';
import { PostService } from './post/post.service';
import { CreatePostDto } from './post/dto/create-post.dto';
import { Post as PostEntity } from './post/entities/post.entity';

@Controller('posts')
export class AppController {
  constructor(private readonly postService: PostService) {}

  @Post()
  async create(@Body() createPostDto: CreatePostDto): Promise<PostEntity> {
    return await this.postService.create(createPostDto);
  }

  @Get()
  async findAll(): Promise<PostEntity[]> {
    return await this.postService.findAll();
  }
}
