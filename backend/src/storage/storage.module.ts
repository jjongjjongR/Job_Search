import { Module } from '@nestjs/common';
import { LocalStorageAdapter } from './adapters/local-storage.adapter';
import { STORAGE_PORT } from './ports/storage.port';

@Module({
  providers: [
    LocalStorageAdapter,
    {
      provide: STORAGE_PORT,
      useExisting: LocalStorageAdapter,
    },
  ],
  exports: [STORAGE_PORT, LocalStorageAdapter],
})
export class StorageModule {}
