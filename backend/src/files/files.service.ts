// src/files/files.service.ts

import { Injectable } from '@nestjs/common';
import { FileEntity } from './entities/file.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
  ) {}

  create(fileData: Partial<FileEntity>) {
    const file = this.fileRepo.create(fileData);
    return this.fileRepo.save(file);
  }

  findAll() {
    return this.fileRepo.find();
  }

  findOne(id: number) {
    return this.fileRepo.findOneBy({ id });
  }

  async deleteById(id: number): Promise<void> {
    await this.fileRepo.delete(id);
  }
}
