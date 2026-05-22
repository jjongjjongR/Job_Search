import { Module } from '@nestjs/common';
import { LocalStorageAdapter } from './adapters/local-storage.adapter';
import { STORAGE_PORT } from './ports/storage.port';

@Module({
  providers: [
    LocalStorageAdapter,
    {
      provide: STORAGE_PORT,
      // 2026-05-18 수정: 미구현 storage provider를 local로 조용히 대체하지 않고 시작 단계에서 차단
      useFactory: (localStorageAdapter: LocalStorageAdapter) => {
        const provider = process.env.STORAGE_PROVIDER ?? 'local';
        if (provider !== 'local') {
          throw new Error(
            `Unsupported STORAGE_PROVIDER "${provider}". Current runtime supports "local".`,
          );
        }

        return localStorageAdapter;
      },
      inject: [LocalStorageAdapter],
    },
  ],
  exports: [STORAGE_PORT, LocalStorageAdapter],
})
export class StorageModule {}
