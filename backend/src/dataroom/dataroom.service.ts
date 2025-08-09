// backend/src/dataroom/dataroom.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDataroomDto } from './dto/create-dataroom.dto';
import { Dataroom } from './entities/dataroom.entity';
import { FilesService } from 'src/files/files.service';

@Injectable()
export class DataroomService {
  constructor(
    @InjectRepository(Dataroom)
    private readonly dataroomRepository: Repository<Dataroom>,
    private readonly filesService: FilesService,
  ) {}

  async create(createDataroomDto: CreateDataroomDto): Promise<Dataroom> {
    const newDataroom = this.dataroomRepository.create(createDataroomDto);
    return this.dataroomRepository.save(newDataroom);
  }

  async findAll(): Promise<Dataroom[]> {
    return this.dataroomRepository.find();
  }

  async findOne(id: number): Promise<Dataroom> {
    const item = await this.dataroomRepository.findOneBy({ id });
    if (!item) {
      throw new NotFoundException(`Dataroom with ID ${id} not found`);
    }
    return item;
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.dataroomRepository.delete(id);

    // files 테이블의 파일도 함께 삭제
    await this.filesService.deleteById(id); // id가 동일하다고 가정

    return (result.affected ?? 0) > 0;
  }
}
