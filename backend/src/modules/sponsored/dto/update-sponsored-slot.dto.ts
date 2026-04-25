import { PartialType } from '@nestjs/swagger';
import { CreateSponsoredSlotDto } from './create-sponsored-slot.dto';

export class UpdateSponsoredSlotDto extends PartialType(CreateSponsoredSlotDto) {}
