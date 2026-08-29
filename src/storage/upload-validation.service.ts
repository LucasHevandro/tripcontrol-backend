import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type UploadKind = 'avatar' | 'receipt';

export interface ValidatedUpload {
    buffer: Buffer;
    mime: string;
    ext: string;
    key: string;
}

type DetectedType = { mime: string; ext: string };

const LIMITS: Record<UploadKind, { maxBytes: number; allowed: string[] }> = {
    avatar: {
        maxBytes: 5 * 1024 * 1024,
        allowed: ['image/jpeg', 'image/png', 'image/webp'],
    },
    receipt: {
        maxBytes: 5 * 1024 * 1024,
        allowed: ['image/jpeg', 'image/png', 'application/pdf'],
    },
};

const LABELS: Record<UploadKind, string> = {
    avatar: 'JPG, PNG ou WebP',
    receipt: 'JPG, PNG ou PDF',
};


@Injectable()
export class UploadValidationService {
    validate(
        file: Express.Multer.File | undefined,
        kind: UploadKind,
    ): ValidatedUpload {
        if (!file || !file.buffer || file.buffer.length === 0) {
            throw new BadRequestException('Nenhum arquivo enviado');
        }

        const { maxBytes, allowed } = LIMITS[kind];

        if (file.buffer.length > maxBytes) {
            throw new BadRequestException(
                `Arquivo muito grande. Máximo ${Math.round(maxBytes / 1024 / 1024)}MB`,
            );
        }

        const detected = detectFileType(file.buffer);

        if (!detected || !allowed.includes(detected.mime)) {
            throw new BadRequestException(
                `Formato não suportado. Use ${LABELS[kind]}`,
            );
        }

        return {
            buffer: file.buffer,
            mime: detected.mime,
            ext: detected.ext,
            key: `${randomUUID()}.${detected.ext}`,
        };
    }
}

// Identifica o tipo real do arquivo pelos primeiros bytes.
export function detectFileType(buf: Buffer): DetectedType | null {
    if (buf.length < 12) return null;

    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return { mime: 'image/jpeg', ext: 'jpg' };
    }

    if (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
    ) {
        return { mime: 'image/png', ext: 'png' };
    }

    if (
        buf.toString('ascii', 0, 4) === 'RIFF' &&
        buf.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return { mime: 'image/webp', ext: 'webp' };
    }

    if (buf.toString('ascii', 0, 5) === '%PDF-') {
        return { mime: 'application/pdf', ext: 'pdf' };
    }

    return null;
}