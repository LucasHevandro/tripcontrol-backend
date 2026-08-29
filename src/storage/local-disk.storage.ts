import { Injectable, Logger } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import type {
    FileStorage,
    StorageBucket,
    StoredFile,
} from './file-storage.interface';

@Injectable()
export class LocalDiskStorage implements FileStorage {
    private readonly logger = new Logger(LocalDiskStorage.name);
    private readonly rootDir = join(process.cwd(), 'uploads');
    private readonly publicPrefix = '/uploads';

    async save(
        bucket: StorageBucket,
        key: string,
        buffer: Buffer,
    ): Promise<StoredFile> {
        const dir = join(this.rootDir, bucket);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, key), buffer);

        return { key, url: `${this.publicPrefix}/${bucket}/${key}` };
    }

    async deleteByUrl(url: string | null | undefined): Promise<void> {
        if (!url || !url.startsWith(`${this.publicPrefix}/`)) return;

        const [bucket, rawKey] = url
            .slice(this.publicPrefix.length + 1)
            .split('/');
        if (!bucket || !rawKey) return;

        const filePath = join(this.rootDir, basename(bucket), basename(rawKey));

        try {
            await unlink(filePath);
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                this.logger.warn(`Falha ao remover ${filePath}: ${String(err)}`);
            }
        }
    }
}