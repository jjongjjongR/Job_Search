import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Comment } from '../comment/entities/comment.entity';

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  content: string;

  @Column()
  author: string;

  @OneToMany(() => Comment, (comment: Comment) => comment.post)
  comments: Comment[];
}
