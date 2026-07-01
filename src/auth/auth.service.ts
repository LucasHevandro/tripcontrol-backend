import {
    Injectable,
    ConflictException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwt: JwtService,
    ) { }

    // ─── Registro ────────────────────────────────────────────────────────────

    async register(dto: RegisterDto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existing) {
            throw new ConflictException('E-mail já cadastrado');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 12);

        const user = await this.prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                password: hashedPassword,
                phone: dto.phone,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                createdAt: true,
            },
        });

        const tokens = await this.generateTokens(user.id, user.email);

        return { user, ...tokens };
    }

    // ─── Login ───────────────────────────────────────────────────────────────

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            throw new UnauthorizedException('Credenciais inválidas');
        }

        const passwordMatch = await bcrypt.compare(dto.password, user.password);

        if (!passwordMatch) {
            throw new UnauthorizedException('Credenciais inválidas');
        }

        const tokens = await this.generateTokens(user.id, user.email);

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            ...tokens,
        };
    }

    // ─── Refresh ──────────────────────────────────────────────────────────────

    async refresh(userId: string, oldRefreshToken: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true },
        });

        if (!user) throw new UnauthorizedException();

        // Invalida o refresh token antigo
        await this.prisma.refreshToken.delete({
            where: { token: oldRefreshToken },
        });

        const tokens = await this.generateTokens(user.id, user.email);
        return tokens;
    }

    // ─── Logout ───────────────────────────────────────────────────────────────

    async logout(userId: string) {
        // Remove todos os refresh tokens do usuário
        await this.prisma.refreshToken.deleteMany({
            where: { userId },
        });

        return { message: 'Logout realizado com sucesso' };
    }

    // ─── Me ───────────────────────────────────────────────────────────────────

    async me(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: {
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
            },
        });
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private async generateTokens(userId: string, email: string) {
        const payload = { sub: userId, email };

        const accessToken = this.jwt.sign(payload, {
            secret: process.env.JWT_SECRET,
            expiresIn: 60 * 15, // 15 minutos em segundos
        });

        const refreshToken = this.jwt.sign(payload, {
            secret: process.env.JWT_REFRESH_SECRET,
            expiresIn: 60 * 60 * 24 * 7, // 7 dias em segundos
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await this.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId,
                expiresAt,
            },
        });

        return { accessToken, refreshToken };
    }
}