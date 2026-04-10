// src/files/files.service.ts

import { Injectable } from '@nestjs/common';
import { FileEntity } from './entities/file.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeOriginalName } from './utils/file-name.util';
import { Inject } from '@nestjs/common';
import {
  STORAGE_PORT,
  StoragePort,
  StoragePurpose,
} from '../storage/ports/storage.port';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
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
      await this.storage.delete(file.filename);
    }
    await this.fileRepo.delete(id);
  }

  // 2026-04-10 신규: durable 스토리지에 파일을 저장하고 storage key를 반환
  async storeFile(
    file: Express.Multer.File,
    purpose: StoragePurpose,
  ) {
    return this.storage.save({
      purpose,
      originalName: normalizeOriginalName(file.originalname),
      buffer: file.buffer,
    });
  }

  // 2026-04-10 신규: 보호 다운로드 시 storage key로 실제 경로를 조회
  async resolveStoredFile(storageKey: string) {
    return this.storage.resolve(storageKey);
  }
}
