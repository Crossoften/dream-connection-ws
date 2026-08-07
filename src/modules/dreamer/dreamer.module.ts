import { Module } from '@nestjs/common';
import { DreamerController } from './dreamer.controller';
import { DreamerService } from './dreamer.service';

@Module({
  controllers: [DreamerController],
  providers: [DreamerService],
})
export class DreamerModule {}
