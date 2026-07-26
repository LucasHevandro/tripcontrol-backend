import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatarUrl: true,
  language: true,
  currency: true,
  notifyEmail: true,
  notifyExpenseAlerts: true,
  notifyRoadmapReminders: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ─── Buscar perfil ────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  // ─── Atualizar dados pessoais ─────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: userId } },
      });
      if (existing) throw new ConflictException('E-mail já está em uso');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: USER_SELECT,
    });
  }

  // ─── Trocar senha ─────────────────────────────────────────────────────────

  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (!user.password) {
      throw new BadRequestException(
        'Esta conta usa login com Google e não possui senha local para alterar',
      );
    }

    const passwordMatch = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!passwordMatch) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'A nova senha deve ser diferente da senha atual',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalida todos os refresh tokens — força novo login em todos os dispositivos
    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    return { message: 'Senha atualizada com sucesso' };
  }

  // ─── Upload de avatar ─────────────────────────────────────────────────────

  async updateAvatar(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato não suportado. Use JPG, PNG ou WebP',
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Arquivo muito grande. Máximo 5MB');
    }

    // TODO: quando tiver storage configurado (S3, Cloudflare R2, etc.),
    // fazer upload aqui e usar a URL retornada.
    // Por ora salva o filename como placeholder.
    const avatarUrl = `/uploads/avatars/${file.filename}`;

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: USER_SELECT,
    });
  }

  // ─── Atualizar preferências ───────────────────────────────────────────────

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: USER_SELECT,
    });
  }
}
