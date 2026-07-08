import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiUnauthorizedResponse,
    ApiConflictResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtGuard } from './guards/jwt.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    @ApiOperation({ summary: 'Cadastrar novo usuário' })
    @ApiCreatedResponse({ description: 'Usuário criado com sucesso' })
    @ApiConflictResponse({ description: 'E-mail já cadastrado' })
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login com e-mail e senha' })
    @ApiOkResponse({ description: 'Login realizado com sucesso' })
    @ApiUnauthorizedResponse({ description: 'Credenciais inválidas' })
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('google')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login/cadastro com conta Google' })
    @ApiOkResponse({ description: 'Autenticação com Google realizada com sucesso' })
    @ApiUnauthorizedResponse({ description: 'Token do Google inválido' })
    googleLogin(@Body() dto: GoogleLoginDto) {
        return this.authService.googleLogin(dto.credential);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtRefreshGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Renovar access token usando refresh token' })
    refresh(@CurrentUser() user: { id: string; refreshToken: string }) {
        return this.authService.refresh(user.id, user.refreshToken);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Encerrar sessão e invalidar tokens' })
    logout(@CurrentUser() user: { id: string }) {
        return this.authService.logout(user.id);
    }

    @Get('me')
    @UseGuards(JwtGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Retornar dados do usuário autenticado' })
    me(@CurrentUser() user: { id: string }) {
        return this.authService.me(user.id);
    }
}