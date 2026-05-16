import { LocalStorageAdapter } from './local-storage.adapter';

describe('LocalStorageAdapter', () => {
  it('rejects path traversal storage keys when resolving files', async () => {
    const adapter = new LocalStorageAdapter();

    await expect(adapter.resolve('../secret.txt')).resolves.toBeNull();
    await expect(adapter.resolve('durable/../../secret.txt')).resolves.toBeNull();
  });

  it('ignores path traversal storage keys when deleting files', async () => {
    const adapter = new LocalStorageAdapter();

    await expect(adapter.delete('../secret.txt')).resolves.toBeUndefined();
    await expect(adapter.delete('temp/../../secret.txt')).resolves.toBeUndefined();
  });
});
