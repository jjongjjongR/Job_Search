// src/post/post.service.ts

import {
  Injectable,
  NotFoundException,
} from '@nestjs/common'; // NotFoundException 추가
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostLike } from './entities/post-like.entity';

export type PostSortBy = 'latest' | 'likes' | 'views';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(PostLike)
    private readonly postLikeRepository: Repository<PostLike>,
  ) {}

  // 게시글 생성
  async create(createPostDto: CreatePostDto): Promise<Post> {
    const post = this.postRepository.create(createPostDto);
    return await this.postRepository.save(post);
  }

  // 모든 게시글 조회
  async findAll(sortBy: PostSortBy = 'latest'): Promise<Post[]> {
    const order =
      sortBy === 'likes'
        ? { likes: 'DESC' as const, createdAt: 'DESC' as const }
        : sortBy === 'views'
          ? { views: 'DESC' as const, createdAt: 'DESC' as const }
          : { createdAt: 'DESC' as const };

    return this.postRepository.find({ order });
  }

  // 특정 게시글 조회 (null 처리 추가)
  async findOne(id: number): Promise<Post> {
    const post = await this.postRepository.findOneBy({ id });
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`); // Post가 없으면 예외 던지기
    }

    post.views += 1;
    await this.postRepository.save(post);

    return post;
  }

  async findOneWithoutIncrement(id: number): Promise<Post> {
    const post = await this.postRepository.findOneBy({ id });
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    return post;
  }

  // 2026-03-18 신규: 현재 사용자 기준 좋아요 여부까지 포함한 게시글 상세 응답 생성
  async findOneWithLikeStatus(id: number, userId: string) {
    const post = await this.findOne(id);
    const existingLike = await this.postLikeRepository.findOne({
      where: { postId: id, userId },
    });

    return {
      ...post,
      likedByCurrentUser: !!existingLike,
    };
  }

  // 2026-03-18 신규: 마이페이지에서 현재 사용자가 작성한 게시글 목록 조회
  async findAuthoredPostsByUser(displayName: string): Promise<Post[]> {
    return this.postRepository.find({
      where: { author: displayName },
      order: { createdAt: 'DESC' },
    });
  }

  // 2026-03-18 신규: 마이페이지에서 현재 사용자가 좋아요한 게시글 목록 조회
  async findLikedPostsByUser(userId: string): Promise<Post[]> {
    const likes = await this.postLikeRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (likes.length === 0) {
      return [];
    }

    const posts = await this.postRepository.find({
      where: { id: In(likes.map((like) => like.postId)) },
      order: { createdAt: 'DESC' },
    });

    return likes
      .map((like) => posts.find((post) => post.id === like.postId))
      .filter((post): post is Post => !!post);
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
    const post = await this.postRepository.findOneBy({ id });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    Object.assign(post, updatePostDto);
    return this.postRepository.save(post);
  }

  async likePost(
    id: number,
    userId: string,
  ): Promise<Post & { likedByCurrentUser: boolean }> {
    const post = await this.findOneWithoutIncrement(id);

    const existingLike = await this.postLikeRepository.findOne({
      where: { postId: id, userId },
    });

    if (existingLike) {
      // 2026-03-18 수정: 이미 누른 좋아요는 취소되도록 기존 기록을 삭제
      await this.postLikeRepository.remove(existingLike);
      // 2026-03-18 수정: 좋아요 취소 시 게시글 좋아요 수를 1 감소시키되 0 아래로는 내려가지 않게 보정
      post.likes = Math.max(0, post.likes - 1);
      // 2026-03-18 수정: 취소 직후 프론트가 바로 회색/핑크 UI를 바꿀 수 있게 현재 상태를 함께 반환
      const savedPost = await this.postRepository.save(post);

      return {
        ...savedPost,
        likedByCurrentUser: false,
      };
    }

    // 2026-03-18 신규: 같은 사용자가 같은 게시글에 다시 좋아요를 못 누르게 기록 저장
    const postLike = this.postLikeRepository.create({
      postId: id,
      userId,
    });
    await this.postLikeRepository.save(postLike);

    post.likes += 1;
    const savedPost = await this.postRepository.save(post);

    return {
      ...savedPost,
      likedByCurrentUser: true,
    };
  }
}
