import { Module, Global } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [TelegramService, MailService],
  exports: [TelegramService, MailService],
})
export class NotificationModule {}
