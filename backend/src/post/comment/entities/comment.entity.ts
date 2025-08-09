// src/post/comment/entities/comment.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Post } from '../../entities/post.entity';

@Entity()
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  content: string;

  @Column()
  author: string;

  @ManyToOne(() => Post, (post: Post) => post.comments, { onDelete: 'CASCADE' }) //1개의 게시글에 여러개의 댓글
  @JoinColumn({ name: 'postId' }) // postId라는 FK 컬럼을 명시적으로 추가
  post: Post;

  @Column()
  postId: number;
}
