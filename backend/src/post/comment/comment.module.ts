// src/post/comment/comment.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { Post } from '../entities/post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Post])],
  providers: [CommentService],
  controllers: [CommentController],
})
export class CommentModule {}
