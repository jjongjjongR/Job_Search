import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { sanitizeStoredFilename } from '../../files/utils/file-name.util';
import {
  SaveFileInput,
  getStorageBucketByPurpose,
  StoragePort,
  StoredFile,
} from '../ports/storage.port';

@Injectable()
export class LocalStorageAdapter implements StoragePort {
  // 2026-05-18 수정: Docker/ECS/EFS 등 배포 환경에서 storage root를 환경변수로 고정할 수 있게 변경
  private readonly storageRoot = path.resolve(
    process.env.BACKEND_STORAGE_ROOT ?? path.join(process.cwd(), 'storage'),
  );

  async save(input: SaveFileInput): Promise<StoredFile> {
    const bucket = getStorageBucketByPurpose(input.purpose);
    const directory = path.join(this.storageRoot, bucket, input.purpose);
    const fileName = `${Date.now()}-${sanitizeStoredFilename(input.originalName)}`;
    const storageKey = `${bucket}/${input.purpose}/${fileName}`;
    const absolutePath = path.join(this.storageRoot, storageKey);

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(absolutePath, input.buffer);

    return {
      storageKey,
      absolutePath,
      size: input.buffer.length,
      bucket,
      purpose: input.purpose,
    };
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = this.resolveSafePath(storageKey);
    if (!absolutePath) {
      return;
    }

    await fs.unlink(absolutePath).catch(() => undefined);
  }

  async resolve(storageKey: string): Promise<StoredFile | null> {
    const absolutePath = this.resolveSafePath(storageKey);
    if (!absolutePath) {
      return null;
    }

    try {
      const stats = await fs.stat(absolutePath);
      return {
        storageKey,
        absolutePath,
        size: stats.size,
        bucket: storageKey.startsWith('temp/') ? 'temp' : 'durable',
        purpose: this.extractPurpose(storageKey),
      };
    } catch {
      return null;
    }
  }

  private extractPurpose(storageKey: string): SaveFileInput['purpose'] {
    const [, purpose = 'dataroom_item'] = storageKey.split('/');
    switch (purpose) {
      case 'user_document':
      case 'dataroom_item':
      case 'report_artifact':
      case 'interview_answer_upload':
      case 'raw_transcript':
      case 'raw_vision_metrics':
        return purpose;
      default:
      return 'dataroom_item';
    }
  }

  private resolveSafePath(storageKey: string): string | null {
    const normalizedKey = storageKey.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalizedKey || normalizedKey.split('/').includes('..')) {
      return null;
    }

    const storageRoot = path.resolve(this.storageRoot);
    const absolutePath = path.resolve(storageRoot, normalizedKey);
    const relativePath = path.relative(storageRoot, absolutePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return null;
    }

    return absolutePath;
  }
}
