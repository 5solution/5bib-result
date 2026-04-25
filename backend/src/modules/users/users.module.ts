import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { LogtoAuthModule } from '../logto-auth';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [LogtoAuthModule, UploadModule],
  controllers: [UsersController],
})
export class UsersModule {}
