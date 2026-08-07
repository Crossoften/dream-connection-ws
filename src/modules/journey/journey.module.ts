import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { JourneyController } from './journey.controller';
import { JourneyService } from './journey.service';

@Module({
  imports: [AiModule],
  controllers: [JourneyController],
  providers: [JourneyService],
})
export class JourneyModule {}
