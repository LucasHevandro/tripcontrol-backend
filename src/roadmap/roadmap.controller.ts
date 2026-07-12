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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoadmapService } from './roadmap.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ActivityStatus } from '../generated/prisma/enums';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdateStatusDto {
  @ApiProperty({ enum: ActivityStatus })
  @IsEnum(ActivityStatus)
  status: ActivityStatus;
}

@ApiTags('Roadmap')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('trips/:tripId/roadmap')
export class RoadmapController {
  constructor(private roadmapService: RoadmapService) {}

  @Get()
  @ApiOperation({ summary: 'Listar roteiro completo agrupado por dia' })
  findAll(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
  ) {
    return this.roadmapService.findAll(user.id, tripId);
  }

  @Post('activities')
  @ApiOperation({ summary: 'Criar nova atividade no roteiro' })
  create(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @Body() dto: CreateActivityDto,
  ) {
    return this.roadmapService.create(user.id, tripId, dto);
  }

  @Patch('activities/:activityId')
  @ApiOperation({ summary: 'Editar atividade' })
  update(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @Param('activityId') activityId: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.roadmapService.update(user.id, tripId, activityId, dto);
  }

  @Patch('activities/:activityId/status')
  @ApiOperation({
    summary:
      'Atualizar status da atividade (concluída, em andamento, pendente)',
  })
  updateStatus(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @Param('activityId') activityId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.roadmapService.updateStatus(
      user.id,
      tripId,
      activityId,
      dto.status,
    );
  }

  @Delete('activities/:activityId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover atividade do roteiro' })
  remove(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.roadmapService.remove(user.id, tripId, activityId);
  }
}
