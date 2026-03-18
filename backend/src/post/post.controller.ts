// src/post/post.controller.ts

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Put,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { assertOwnerOrMaster } from '../common/utils/ownership.util';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { Post as PostEntity } from './entities/post.entity';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostSortBy } from './post.service';

@ApiTags('posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  async create(
    @Body() createPostDto: CreatePostDto,
    @CurrentUser() currentUser: JwtUser,
  ): Promise<PostEntity> {
    return this.postService.create({
      ...createPostDto,
      author: currentUser.displayName,
    });
  }

  @Get()
  async findAll(
    @Query('sortBy') sortBy?: PostSortBy,
  ): Promise<PostEntity[]> {
    return this.postService.findAll(sortBy);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PostEntity> {
    return await this.postService.findOne(Number(id));
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtUser,
  ): Promise<string> {
    const post = await this.postService.findOne(Number(id));
    assertOwnerOrMaster(currentUser, post.author, '게시글');
    await this.postService.remove(Number(id));
    return `Post with ID ${id} deleted successfully`;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @CurrentUser() currentUser: JwtUser,
  ): Promise<PostEntity> {
    const post = await this.postService.findOne(Number(id));
    assertOwnerOrMaster(currentUser, post.author, '게시글');
    return this.postService.update(Number(id), updatePostDto);
  }

  @Post(':id/like')
  async likePost(@Param('id') id: string): Promise<PostEntity> {
    return this.postService.likePost(Number(id));
  }
}
