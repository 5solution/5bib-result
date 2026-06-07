import { ApiProperty } from '@nestjs/swagger';
import {
  MERCHANT_PORTAL_PERMISSION_VALUES,
  type MerchantPortalPermission,
} from '../schemas/merchant-portal-access.schema';

export class MerchantMeResponseDto {
  @ApiProperty({ description: 'Logto user ID', example: 'logto_4a9f2b71c0' })
  userId: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  userName: string;

  @ApiProperty({ example: 'a@btc.vn' })
  email: string;

  @ApiProperty({
    description: 'MySQL tenant IDs user được assign',
    type: [Number],
    example: [42, 99],
  })
  tenantIds: number[];

  @ApiProperty({
    description: 'Permission level — drives UI tab visibility',
    enum: MERCHANT_PORTAL_PERMISSION_VALUES,
    isArray: true,
    example: ['ticket_report', 'revenue_report'],
  })
  permissions: MerchantPortalPermission[];

  @ApiProperty({
    description: 'Số giải user được phép xem (resolved non-draft)',
    example: 5,
  })
  assignedRaceCount: number;
}
