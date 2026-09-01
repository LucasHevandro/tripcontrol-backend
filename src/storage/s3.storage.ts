import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  FileStorage,
  StorageBucket,
  StoredFile,
} from './file-storage.interface';

const SIGNED_URL_TTL_SECONDS = 15 * 60;
const PRIVATE_REF_PREFIX = 's3-private://';

/*
 * Armazenamento em Cloudflare R2 (compatível com S3).
 *
 * Dois buckets:
 * - público  → avatares. O banco guarda a URL pública final.
 * - privado  → comprovantes. O banco guarda uma referência opaca
 *              ("s3-private://<key>") que vira URL assinada só na leitura,
 *              e só para quem passou pela autorização do service.
 */
@Injectable()
export class S3Storage implements FileStorage {
  private readonly logger = new Logger(S3Storage.name);
  private readonly client: S3Client;
  private readonly publicBucket: string;
  private readonly privateBucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.client = new S3Client({
      region: config.get<string>('S3_REGION', 'auto'),
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
    });
    this.publicBucket = config.getOrThrow<string>('S3_BUCKET_PUBLIC');
    this.privateBucket = config.getOrThrow<string>('S3_BUCKET_PRIVATE');
    this.publicUrl = config
      .getOrThrow<string>('S3_PUBLIC_URL')
      .replace(/\/+$/, '');
  }

  async save(
    bucket: StorageBucket,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<StoredFile> {
    const isPublic = bucket === 'avatars';
    const objectKey = `${bucket}/${key}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: isPublic ? this.publicBucket : this.privateBucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
        CacheControl: isPublic
          ? 'public, max-age=31536000, immutable'
          : undefined,
      }),
    );

    return {
      key,
      url: isPublic
        ? `${this.publicUrl}/${objectKey}`
        : `${PRIVATE_REF_PREFIX}${objectKey}`,
    };
  }

  async resolveReadUrl(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;
    if (!url.startsWith(PRIVATE_REF_PREFIX)) return url;

    const objectKey = url.slice(PRIVATE_REF_PREFIX.length);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.privateBucket, Key: objectKey }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
  }

  async deleteByUrl(url: string | null | undefined): Promise<void> {
    const target = this.parseOwnedUrl(url);
    if (!target) return;

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: target.bucket, Key: target.key }),
      );
    } catch (err) {
      this.logger.warn(
        `Falha ao remover ${target.bucket}/${target.key}: ${String(err)}`,
      );
    }
  }

  private parseOwnedUrl(
    url: string | null | undefined,
  ): { bucket: string; key: string } | null {
    if (!url) return null;

    if (url.startsWith(PRIVATE_REF_PREFIX)) {
      return {
        bucket: this.privateBucket,
        key: url.slice(PRIVATE_REF_PREFIX.length),
      };
    }

    if (url.startsWith(`${this.publicUrl}/`)) {
      return {
        bucket: this.publicBucket,
        key: url.slice(this.publicUrl.length + 1),
      };
    }

    return null;
  }
}
