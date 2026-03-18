// src/files/files.service.ts

import { Injectable } from '@nestjs/common';
import { FileEntity } from './entities/file.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { normalizeOriginalName } from './utils/file-name.util';

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
    return this.fileRepo.find().then((files) =>
      files.map((file) => ({
        ...file,
        originalname: normalizeOriginalName(file.originalname),
      })),
    );
  }

  async findOne(id: number) {
    const file = await this.fileRepo.findOneBy({ id });
    if (!file) {
      return null;
    }

    file.originalname = normalizeOriginalName(file.originalname);
    return file;
  }

  async deleteById(id: number): Promise<void> {
    const file = await this.fileRepo.findOneBy({ id });
    if (file) {
      const filePath = path.join(process.cwd(), 'uploads', file.filename);
      await fs.unlink(filePath).catch(() => undefined);
    }
    await this.fileRepo.delete(id);
  }
}
