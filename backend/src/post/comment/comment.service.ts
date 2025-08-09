// src/post/comment/comment.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  async create(createCommentDto: CreateCommentDto): Promise<Comment> {
    const comment = this.commentRepository.create(createCommentDto);
    return await this.commentRepository.save(comment);
  }

  async findByPostId(postId: number): Promise<Comment[]> {
    return await this.commentRepository.find({
      where: { postId },
    });
  }

  async findOne(id: number): Promise<Comment> {
    const comment = await this.commentRepository.findOneBy({ id });
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }
    return comment;
  }

  async update(
    id: number,
    updateCommentDto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.commentRepository.findOneBy({ id });
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }
    Object.assign(comment, updateCommentDto);
    return await this.commentRepository.save(comment);
  }

  async remove(id: number): Promise<void> {
    const result = await this.commentRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }
  }
}
