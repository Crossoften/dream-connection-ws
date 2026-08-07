import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DreamsController } from './dreams.controller';
import { DreamsService } from './dreams.service';

@Module({
  imports: [AiModule],
  controllers: [DreamsController],
  providers: [DreamsService],
})
export class DreamsModule {}
