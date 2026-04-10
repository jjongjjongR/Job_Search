export type StorageBucket = 'durable' | 'temp';
export type StoragePurpose =
  | 'user_document'
  | 'dataroom_item'
  | 'report_artifact'
  | 'interview_answer_upload'
  | 'raw_transcript'
  | 'raw_vision_metrics';

export interface SaveFileInput {
  purpose: StoragePurpose;
  originalName: string;
  buffer: Buffer;
}

export interface StoredFile {
  storageKey: string;
  absolutePath: string;
  size: number;
  bucket: StorageBucket;
  purpose: StoragePurpose;
}

export interface StoragePort {
  save(input: SaveFileInput): Promise<StoredFile>;
  delete(storageKey: string): Promise<void>;
  resolve(storageKey: string): Promise<StoredFile | null>;
}

export const STORAGE_PORT = Symbol('STORAGE_PORT');

export function getStorageBucketByPurpose(
  purpose: StoragePurpose,
): StorageBucket {
  switch (purpose) {
    case 'user_document':
    case 'dataroom_item':
    case 'report_artifact':
      return 'durable';
    case 'interview_answer_upload':
    case 'raw_transcript':
    case 'raw_vision_metrics':
      return 'temp';
  }
}
