import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { getTypeOrmConfig } from './database/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostModule } from './post/post.module';
import { CommentModule } from './post/comment/comment.module';
import { FilesModule } from './files/files.module';
import { DataroomModule } from './dataroom/dataroom.module';
import { AiClientModule } from './ai-client/ai-client.module';
import { JobsModule } from './jobs/jobs.module';
import { CoverLetterModule } from './cover-letter/cover-letter.module';
import { InterviewModule } from './interview/interview.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [configuration],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getTypeOrmConfig(configService),
    }),
    AuthModule,
    UsersModule,
    PostModule,
    CommentModule,
    FilesModule,
    DataroomModule,
    AiClientModule,
    JobsModule,
    CoverLetterModule,
    InterviewModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
