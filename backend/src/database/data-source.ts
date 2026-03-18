import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Post } from '../post/entities/post.entity';
import { Comment } from '../post/comment/entities/comment.entity';
import { FileEntity } from '../files/entities/file.entity';
import { Dataroom } from '../dataroom/entities/dataroom.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'world_job_search',
  entities: [User, Post, Comment, FileEntity, Dataroom],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
