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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtUser } from '../../auth/interfaces/jwt-user.interface';
import { assertOwnerOrMaster } from '../../common/utils/ownership.util';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  async create(
    @Body() dto: CreateCommentDto,
    @CurrentUser() currentUser: JwtUser,
  ): Promise<Comment> {
    return this.commentService.create({
      ...dto,
      author: currentUser.displayName,
    });
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
    @CurrentUser() currentUser: JwtUser,
  ): Promise<Comment> {
    const comment = await this.commentService.findOne(Number(id));
    assertOwnerOrMaster(currentUser, comment.author, '댓글');
    return this.commentService.update(Number(id), dto);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtUser,
  ): Promise<string> {
    const comment = await this.commentService.findOne(Number(id));
    assertOwnerOrMaster(currentUser, comment.author, '댓글');
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
