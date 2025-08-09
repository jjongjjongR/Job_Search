import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// App 기본
import { AppController } from './app.controller';
import { AppService } from './app.service';

// 기능 모듈
import { PostModule } from './post/post.module';
import { CommentModule } from './post/comment/comment.module';
import { FilesModule } from './files/files.module';
import { DataroomModule } from './dataroom/dataroom.module';
import { FeedbackModule } from './feedback/feedback.module';
import { InterviewModule } from './interview/interview.module';

// 엔티티
import { Post } from './post/entities/post.entity';
import { Comment } from './post/comment/entities/comment.entity';
import { Dataroom } from './dataroom/entities/dataroom.entity';
import { FileEntity } from './files/entities/file.entity';

// (선택) 테스트용 컨트롤러 추가 시 import
import { TestController } from './test/test.controller';

@Module({
  imports: [
    // .env 설정 (가장 먼저)
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),

    // DB 연결
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'myuser',
      password: 'mypassword',
      database: 'myproject',
      entities: [Post, Comment, Dataroom, FileEntity],
      synchronize: true, // 운영에서는 false로!
    }),

    // 기능 모듈 등록
    PostModule,
    CommentModule,
    FilesModule,
    DataroomModule,
    FeedbackModule,
    InterviewModule,
  ],
  controllers: [
    AppController,
    TestController, // (테스트용 컨트롤러 등록 시)
  ],
  providers: [AppService],
})
export class AppModule {}
