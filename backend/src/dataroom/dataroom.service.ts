// backend/src/dataroom/dataroom.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDataroomDto } from './dto/create-dataroom.dto';
import { Dataroom } from './entities/dataroom.entity';
import { FilesService } from 'src/files/files.service';
import { normalizeOriginalName } from 'src/files/utils/file-name.util';

@Injectable()
export class DataroomService {
  constructor(
    @InjectRepository(Dataroom)
    private readonly dataroomRepository: Repository<Dataroom>,
    private readonly filesService: FilesService,
  ) {}

  async create(createDataroomDto: CreateDataroomDto): Promise<Dataroom> {
    const file = await this.filesService.findOne(createDataroomDto.fileId);
    const newDataroom = this.dataroomRepository.create({
      title: createDataroomDto.title,
      description: createDataroomDto.description,
      uploader: createDataroomDto.uploader,
      file: file ?? undefined,
    });
    return this.dataroomRepository.save(newDataroom);
  }

  async findAll(): Promise<Dataroom[]> {
    const items = await this.dataroomRepository.find({
      relations: {
        file: true,
      },
      order: {
        id: 'DESC',
      },
    });

    return items.map((item) => {
      if (item.file) {
        item.file.originalname = normalizeOriginalName(item.file.originalname);
      }

      return item;
    });
  }

  async findOne(id: number): Promise<Dataroom> {
    const item = await this.dataroomRepository.findOne({
      where: { id },
      relations: {
        file: true,
      },
    });
    if (!item) {
      throw new NotFoundException(`Dataroom with ID ${id} not found`);
    }

    if (item.file) {
      item.file.originalname = normalizeOriginalName(item.file.originalname);
    }

    return item;
  }

  async remove(id: number): Promise<boolean> {
    const item = await this.findOne(id);
    const result = await this.dataroomRepository.delete(id);

    if (item.fileId) {
      await this.filesService.deleteById(item.fileId);
    }

    return (result.affected ?? 0) > 0;
  }
}
