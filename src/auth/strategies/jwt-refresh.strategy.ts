import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(private prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_REFRESH_SECRET!,
            passReqToCallback: true,
        });
    }

    async validate(req: Request, payload: { sub: string }) {
        const authHeader = (req.headers as any)['authorization'];
        const refreshToken = authHeader?.replace('Bearer ', '');

        const stored = await this.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
        });

        if (!stored || stored.expiresAt < new Date()) {
            throw new UnauthorizedException('Refresh token inválido ou expirado');
        }

        return { id: payload.sub, refreshToken };
    }
}