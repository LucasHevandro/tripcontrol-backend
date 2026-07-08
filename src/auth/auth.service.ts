import {
    Injectable,
    ConflictException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
    private googleClient: OAuth2Client;

    constructor(
        private prisma: PrismaService,
        private jwt: JwtService,
        private configService: ConfigService,
    ) {
        this.googleClient = new OAuth2Client(
            this.configService.get<string>('GOOGLE_CLIENT_ID'),
        );
    }

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

        // Conta criada via Google não possui senha local
        if (!user.password) {
            throw new UnauthorizedException(
                'Esta conta usa login com Google. Entre pelo botão do Google.',
            );
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

    // ─── Login com Google ─────────────────────────────────────────────────────

    async googleLogin(credential: string) {
        // 1. Valida o ID token com o Google e extrai os dados verificados
        const payload = await this.verifyGoogleToken(credential);

        const { email, name, picture, sub: googleId } = payload;

        if (!email) {
            throw new UnauthorizedException(
                'Não foi possível obter o e-mail da conta Google',
            );
        }

        // 2. Procura usuário pelo googleId ou pelo e-mail
        let user = await this.prisma.user.findFirst({
            where: {
                OR: [{ googleId }, { email }],
            },
        });

        if (user) {
            // Conta existe por e-mail mas ainda não vinculada ao Google → vincula
            if (!user.googleId) {
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        googleId,
                        // preenche avatar do Google se o usuário ainda não tiver um
                        avatarUrl: user.avatarUrl ?? picture ?? null,
                    },
                });
            }
        } else {
            // 3. Não existe → cria conta nova (sem senha)
            user = await this.prisma.user.create({
                data: {
                    name: name ?? email.split('@')[0],
                    email,
                    googleId,
                    avatarUrl: picture ?? null,
                    password: null,
                },
            });
        }

        // 4. Gera o mesmo par de tokens do login normal
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

    private async verifyGoogleToken(credential: string) {
        const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

        try {
            const ticket = await this.googleClient.verifyIdToken({
                idToken: credential,
                audience: clientId,
            });

            const payload = ticket.getPayload();
            if (!payload) {
                throw new UnauthorizedException('Token do Google inválido');
            }
            return payload;
        } catch {
            throw new UnauthorizedException(
                'Não foi possível validar o login com Google',
            );
        }
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
            secret: this.configService.getOrThrow<string>('JWT_SECRET'),
            expiresIn: this.parseDurationToSeconds(
                this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
            ),
        });

        const refreshToken = this.jwt.sign(payload, {
            secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
            expiresIn: this.parseDurationToSeconds(
                this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
            ),
        });

        const refreshExpiresIn = this.configService.get<string>(
            'JWT_REFRESH_EXPIRES_IN',
            '7d',
        );
        const expiresAt = new Date(
            Date.now() + this.parseDurationToMilliseconds(refreshExpiresIn),
        );

        await this.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId,
                expiresAt,
            },
        });

        return { accessToken, refreshToken };
    }

    private parseDurationToMilliseconds(value: string) {
        const match = value.match(/^(\d+)([smhd])$/);

        if (!match) {
            return 7 * 24 * 60 * 60 * 1000;
        }

        const amount = Number(match[1]);
        const unit = match[2];

        const multipliers: Record<string, number> = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
        };

        return amount * multipliers[unit as keyof typeof multipliers];
    }

    private parseDurationToSeconds(value: string) {
        return Math.floor(this.parseDurationToMilliseconds(value) / 1000);
    }

}