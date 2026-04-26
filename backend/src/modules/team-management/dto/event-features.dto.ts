import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';

/** PATCH /team-management/events/:id/features */
export class UpdateEventFeaturesDto {
  @ApiProperty({
    enum: ['full', 'lite'],
    description: 'full = all features; lite = personnel + contract only (no QR, station, supply)',
  })
  @IsEnum(['full', 'lite'])
  feature_mode!: 'full' | 'lite';

  @ApiProperty({
    description: 'true = admin must confirm nghiem thu before marking completed; false = skip',
  })
  @IsBoolean()
  feature_nghiem_thu!: boolean;
}

/** GET /team-management/events/:id/config (and public variant) */
export class EventFeaturesConfigDto {
  @ApiProperty()
  event_id!: number;

  @ApiProperty({ enum: ['full', 'lite'] })
  feature_mode!: 'full' | 'lite';

  @ApiProperty()
  feature_nghiem_thu!: boolean;
}

/** Body for PATCH /team-management/registrations/:id/nghiem-thu */
export class ConfirmNghiemThuDto {
  @ApiProperty({ required: false, maxLength: 1000 })
  note?: string;
}

/** Response for PATCH /team-management/registrations/:id/nghiem-thu */
export class NghiemThuResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  completed_at!: string;
}
