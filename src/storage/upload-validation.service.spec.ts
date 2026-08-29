import { BadRequestException } from '@nestjs/common';
import {
    UploadValidationService,
    detectFileType,
} from './upload-validation.service';

const PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n');
const WEBP = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('WEBP'),
]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

const asMulter = (buffer: Buffer, mimetype = 'image/png') =>
    ({
        buffer,
        mimetype,
        originalname: 'x.html',
        size: buffer.length,
    }) as Express.Multer.File;

describe('detectFileType', () => {
    it('identifica os formatos suportados pelos magic bytes', () => {
        expect(detectFileType(PNG)?.mime).toBe('image/png');
        expect(detectFileType(JPEG)?.mime).toBe('image/jpeg');
        expect(detectFileType(PDF)?.mime).toBe('application/pdf');
        expect(detectFileType(WEBP)?.mime).toBe('image/webp');
        expect(detectFileType(HTML)).toBeNull();
    });
});

describe('UploadValidationService', () => {
    const service = new UploadValidationService();

    it('gera nome no servidor com extensão derivada do conteúdo, ignorando originalname', () => {
        const result = service.validate(asMulter(PNG), 'avatar');
        expect(result.mime).toBe('image/png');
        expect(result.key).toMatch(/^[0-9a-f-]{36}\.png$/);
    });

    it('rejeita HTML mesmo com mimetype declarado como imagem', () => {
        expect(() =>
            service.validate(asMulter(HTML, 'image/png'), 'avatar'),
        ).toThrow(BadRequestException);
    });

    it('rejeita PDF como avatar mas aceita como comprovante', () => {
        expect(() => service.validate(asMulter(PDF), 'avatar')).toThrow(
            BadRequestException,
        );
        expect(service.validate(asMulter(PDF), 'receipt').ext).toBe('pdf');
    });

    it('rejeita WebP como comprovante', () => {
        expect(() => service.validate(asMulter(WEBP), 'receipt')).toThrow(
            BadRequestException,
        );
    });

    it('rejeita arquivo ausente ou vazio', () => {
        expect(() => service.validate(undefined, 'avatar')).toThrow(
            BadRequestException,
        );
        expect(() =>
            service.validate(asMulter(Buffer.alloc(0)), 'avatar'),
        ).toThrow(BadRequestException);
    });

    it('rejeita arquivo acima do limite', () => {
        const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
        expect(() => service.validate(asMulter(big), 'avatar')).toThrow(
            /muito grande/,
        );
    });
});