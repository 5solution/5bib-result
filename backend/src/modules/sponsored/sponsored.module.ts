import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SponsoredSlot, SponsoredSlotSchema } from './schemas/sponsored-slot.schema';
import { SponsoredController } from './sponsored.controller';
import { PublicSponsoredController } from './public-sponsored.controller';
import { SponsoredService } from './sponsored.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SponsoredSlot.name, schema: SponsoredSlotSchema },
    ]),
  ],
  controllers: [SponsoredController, PublicSponsoredController],
  providers: [SponsoredService],
  exports: [SponsoredService],
})
export class SponsoredModule {}
