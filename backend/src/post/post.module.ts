// src/post/post.module.ts

import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { TypeOrmModule } from '@nestjs/typeorm'; // TypeOrmModule 추가
import { Post } from './entities/post.entity'; // Post 엔티티 추가
import { PostLike } from './entities/post-like.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Post, PostLike])], // TypeORM에서 Post 엔티티 사용
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
