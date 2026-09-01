import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface ProcessedImage {
  buffer: Buffer;
  mime: 'image/webp';
  ext: 'webp';
  width: number;
  height: number;
}

const AVATAR_SIZE = 256;
const AVATAR_QUALITY = 80;

/**
 * Normaliza imagens enviadas pelo usuário.
 *
 * Reencodar a imagem faz três coisas de uma vez: reduz o tamanho (um JPG de
 * 5 MB vira ~20 KB), remove metadados EXIF (que podem conter geolocalização
 * da foto) e descarta qualquer conteúdo estranho embutido no arquivo original.
 */
@Injectable()
export class ImageProcessingService {
  async processAvatar(input: Buffer): Promise<ProcessedImage> {
    try {
      const { data, info } = await sharp(input)
        .rotate()
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
        .webp({ quality: AVATAR_QUALITY })
        .toBuffer({ resolveWithObject: true });

      return {
        buffer: data,
        mime: 'image/webp',
        ext: 'webp',
        width: info.width,
        height: info.height,
      };
    } catch {
      throw new BadRequestException(
        'Não foi possível processar a imagem. Tente outro arquivo.',
      );
    }
  }
}
