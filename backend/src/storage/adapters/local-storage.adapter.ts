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
  // 2026-04-10 신규: durable/temp 저장 루트를 한 곳에서 관리
  private readonly storageRoot = path.join(process.cwd(), 'storage');

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
    const absolutePath = path.join(this.storageRoot, storageKey);
    await fs.unlink(absolutePath).catch(() => undefined);
  }

  async resolve(storageKey: string): Promise<StoredFile | null> {
    const absolutePath = path.join(this.storageRoot, storageKey);

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
}
