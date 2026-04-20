import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { ClerkAuthModule } from '../clerk-auth';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [ClerkAuthModule, UploadModule],
  controllers: [UsersController],
})
export class UsersModule {}
