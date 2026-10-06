import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { ReminderController } from './reminder.controller';
import { ReminderScheduler } from './reminder.scheduler';
import { ReminderService } from './reminder.service';

@Module({
  controllers: [ReminderController],
  providers: [ReminderService, PushService, ReminderScheduler],
})
export class ReminderModule {}
