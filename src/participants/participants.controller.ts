import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { ParticipantsService } from './participants.service';
import { InviteByEmailDto } from './dto/invite-by-email.dto';
import { SetSponsorDto } from './dto/set-sponsor.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Participants')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('trips/:tripId/participants')
export class ParticipantsController {
    constructor(private participantsService: ParticipantsService) { }

    @Get()
    @ApiOperation({ summary: 'Listar participantes com saldos e acertos' })
    findAll(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
    ) {
        return this.participantsService.findAll(user.id, tripId);
    }

    @Post('invite')
    @ApiOperation({ summary: 'Convidar participantes via e-mail' })
    inviteByEmail(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
        @Body() dto: InviteByEmailDto,
    ) {
        return this.participantsService.inviteByEmail(user.id, tripId, dto);
    }

    @Get('invite-link')
    @ApiOperation({ summary: 'Buscar link de convite da viagem' })
    getInviteLink(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
    ) {
        return this.participantsService.getInviteLink(user.id, tripId);
    }

    @Get('settlements')
    @ApiOperation({ summary: 'Calcular acertos financeiros entre participantes' })
    getSettlements(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
    ) {
        return this.participantsService.getSettlements(user.id, tripId);
    }

    @Post('settlements/notify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Notificar todos os devedores' })
    notifyDebtors(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
    ) {
        return this.participantsService.notifyDebtors(user.id, tripId);
    }

    @Patch(':participantId/sponsor')
    @ApiOperation({ summary: 'Vincular/desvincular um participante como dependente' })
    setSponsor(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
        @Param('participantId') participantId: string,
        @Body() dto: SetSponsorDto,
    ) {
        return this.participantsService.setSponsor(user.id, tripId, participantId, dto.sponsorId);
    }

    @Delete(':participantId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Remover participante (só organizador)' })
    remove(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
        @Param('participantId') participantId: string,
    ) {
        return this.participantsService.remove(user.id, tripId, participantId);
    }
}

@ApiTags('Participants')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('trips')
export class JoinController {
    constructor(private participantsService: ParticipantsService) { }

    @Post('join/:token')
    @ApiOperation({ summary: 'Entrar numa viagem via link ou token de convite' })
    join(
        @CurrentUser() user: { id: string },
        @Param('token') token: string,
    ) {
        return this.participantsService.joinByToken(user.id, token);
    }
}