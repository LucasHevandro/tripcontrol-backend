import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FILE_STORAGE, type FileStorage } from './file-storage.interface';
import { LocalDiskStorage } from './local-disk.storage';
import { S3Storage } from './s3.storage';
import { UploadValidationService } from './upload-validation.service';
import { ImageProcessingService } from './image-processing.service';

/**
 * Módulo global: qualquer service pode injetar FILE_STORAGE,
 * UploadValidationService e ImageProcessingService sem importar o módulo.
 *
 * O driver é escolhido por STORAGE_DRIVER:
 * - local (padrão) → disco em ./uploads, servido como estático em /uploads
 * - s3 → Cloudflare R2
 */
@Global()
@Module({
  providers: [
    UploadValidationService,
    ImageProcessingService,
    {
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): FileStorage =>
        config.get<string>('STORAGE_DRIVER', 'local') === 's3'
          ? new S3Storage(config)
          : new LocalDiskStorage(),
    },
  ],
  exports: [UploadValidationService, ImageProcessingService, FILE_STORAGE],
})
export class StorageModule {}
