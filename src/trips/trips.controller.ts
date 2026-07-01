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
    ApiCreatedResponse,
    ApiOkResponse,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
} from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Trips')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('trips')
export class TripsController {
    constructor(private tripsService: TripsService) { }

    @Get()
    @ApiOperation({ summary: 'Listar viagens do usuário autenticado' })
    @ApiOkResponse({ description: 'Lista de viagens com contagens e saldos' })
    findAll(@CurrentUser() user: { id: string }) {
        return this.tripsService.findAll(user.id);
    }

    @Post()
    @ApiOperation({ summary: 'Criar nova viagem' })
    @ApiCreatedResponse({ description: 'Viagem criada com sucesso' })
    create(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateTripDto,
    ) {
        return this.tripsService.create(user.id, dto);
    }

    @Get(':tripId')
    @ApiOperation({ summary: 'Buscar dados completos de uma viagem' })
    @ApiNotFoundResponse({ description: 'Viagem não encontrada' })
    @ApiForbiddenResponse({ description: 'Usuário não é participante' })
    findOne(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
    ) {
        return this.tripsService.findOne(user.id, tripId);
    }

    @Get(':tripId/dashboard')
    @ApiOperation({ summary: 'Buscar dados do dashboard de uma viagem' })
    getDashboard(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
    ) {
        return this.tripsService.getDashboard(user.id, tripId);
    }

    @Patch(':tripId')
    @ApiOperation({ summary: 'Atualizar dados da viagem (só organizador)' })
    update(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
        @Body() dto: UpdateTripDto,
    ) {
        return this.tripsService.update(user.id, tripId, dto);
    }

    @Delete(':tripId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Deletar viagem (só organizador)' })
    remove(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
    ) {
        return this.tripsService.remove(user.id, tripId);
    }
}