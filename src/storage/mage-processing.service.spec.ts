import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { ImageProcessingService } from './image-processing.service';

describe('ImageProcessingService', () => {
    const service = new ImageProcessingService();

    const makePng = (width: number, height: number) =>
        sharp({
            create: { width, height, channels: 3, background: '#3355aa' },
        })
            .png()
            .toBuffer();

    it('redimensiona para 256x256 e converte para WebP', async () => {
        const input = await makePng(1200, 800);

        const result = await service.processAvatar(input);

        expect(result.mime).toBe('image/webp');
        expect(result.ext).toBe('webp');
        expect(result.width).toBe(256);
        expect(result.height).toBe(256);
        expect(result.buffer.length).toBeLessThan(input.length);

        const meta = await sharp(result.buffer).metadata();
        expect(meta.format).toBe('webp');
    });

    it('descarta metadados EXIF', async () => {
        const withExif = await sharp(await makePng(400, 400))
            .withMetadata({ exif: { IFD0: { ImageDescription: 'secreto' } } })
            .jpeg()
            .toBuffer();
        expect((await sharp(withExif).metadata()).exif).toBeDefined();

        const result = await service.processAvatar(withExif);

        expect((await sharp(result.buffer).metadata()).exif).toBeUndefined();
    });

    it('rejeita conteúdo corrompido', async () => {
        const corrupted = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6]);

        await expect(service.processAvatar(corrupted)).rejects.toThrow(
            BadRequestException,
        );
    });
});