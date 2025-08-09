// backend/src/dataroom/dataroom.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataroomService } from './dataroom.service';
import { DataroomController } from './dataroom.controller';
import { Dataroom } from './entities/dataroom.entity';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [TypeOrmModule.forFeature([Dataroom]), FilesModule],
  controllers: [DataroomController],
  providers: [DataroomService],
})
export class DataroomModule {}
