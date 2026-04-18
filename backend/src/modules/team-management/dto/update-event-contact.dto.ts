import { PartialType } from '@nestjs/swagger';
import { CreateEventContactDto } from './create-event-contact.dto';

export class UpdateEventContactDto extends PartialType(CreateEventContactDto) {}
