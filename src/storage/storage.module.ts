import { Global, Module } from '@nestjs/common';
import { FILE_STORAGE } from './file-storage.interface';
import { LocalDiskStorage } from './local-disk.storage';
import { UploadValidationService } from './upload-validation.service';
import { ImageProcessingService } from './image-processing.service';

@Global()
@Module({
    providers: [
        UploadValidationService,
        { provide: FILE_STORAGE, useClass: LocalDiskStorage },
    ],
    exports: [UploadValidationService, ImageProcessingService, FILE_STORAGE],
})
export class StorageModule { }