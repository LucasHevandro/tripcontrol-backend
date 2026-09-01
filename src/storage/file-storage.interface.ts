export type StorageBucket = 'avatars' | 'receipts';

export interface StoredFile {
  key: string;
  url: string;
}

export interface FileStorage {
  save(
    bucket: StorageBucket,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<StoredFile>;
  resolveReadUrl(url: string | null | undefined): Promise<string | null>;
  deleteByUrl(url: string | null | undefined): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
