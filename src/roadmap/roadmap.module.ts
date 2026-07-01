import { Module } from '@nestjs/common';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';
import { TripsModule } from '../trips/trips.module';

@Module({
    imports: [TripsModule],
    controllers: [RoadmapController],
    providers: [RoadmapService],
    exports: [RoadmapService],
})
export class RoadmapModule { }