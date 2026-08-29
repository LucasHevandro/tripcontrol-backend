import { Global, Module } from '@nestjs/common';
import { FILE_STORAGE } from './file-storage.interface';
import { LocalDiskStorage } from './local-disk.storage';
import { UploadValidationService } from './upload-validation.service';

@Global()
@Module({
    providers: [
        UploadValidationService,
        { provide: FILE_STORAGE, useClass: LocalDiskStorage },
    ],
    exports: [UploadValidationService, FILE_STORAGE],
})
export class StorageModule { }