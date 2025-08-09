// src/post/post.service.ts

import { Injectable, NotFoundException } from '@nestjs/common'; // NotFoundException 추가
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  // 게시글 생성
  async create(createPostDto: CreatePostDto): Promise<Post> {
    const post = this.postRepository.create(createPostDto);
    return await this.postRepository.save(post);
  }

  // 모든 게시글 조회
  async findAll(): Promise<Post[]> {
    return await this.postRepository.find();
  }

  // 특정 게시글 조회 (null 처리 추가)
  async findOne(id: number): Promise<Post> {
    const post = await this.postRepository.findOneBy({ id });
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`); // Post가 없으면 예외 던지기
    }
    return post;
  }

  // 게시글 삭제
  async remove(id: number): Promise<void> {
    const result = await this.postRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Post with ID ${id} not found`); // 삭제할 게시글이 없으면 예외 던지기
    }
  }

  // 게시글 수정
  async update(id: number, updatePostDto: UpdatePostDto) {
    console.log('[UPDATE] 요청 받은 ID:', id);
    console.log('[UPDATE] 요청 바디:', updatePostDto);

    const post = await this.postRepository.findOneBy({ id });
    console.log('[UPDATE] 찾은 게시물:', post);

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    Object.assign(post, updatePostDto);
    return this.postRepository.save(post);
  }
}
