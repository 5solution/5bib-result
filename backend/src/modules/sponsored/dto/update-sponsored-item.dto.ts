import { PartialType } from '@nestjs/swagger';
import { CreateSponsoredItemDto } from './create-sponsored-item.dto';

export class UpdateSponsoredItemDto extends PartialType(CreateSponsoredItemDto) {}
