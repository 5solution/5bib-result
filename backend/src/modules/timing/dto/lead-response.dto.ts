import { ApiProperty } from '@nestjs/swagger';

export class TimingLeadResponseDto {
  @ApiProperty() _id: string;
  @ApiProperty() lead_number: number;
  @ApiProperty() full_name: string;
  @ApiProperty() phone: string;
  @ApiProperty() organization: string;
  @ApiProperty() athlete_count_range: string;
  @ApiProperty({ enum: ['basic', 'advanced', 'professional', 'unspecified'] })
  package_interest: string;
  @ApiProperty() notes: string;
  @ApiProperty({
    enum: ['new', 'contacted', 'quoted', 'closed_won', 'closed_lost'],
  })
  status: string;
  @ApiProperty() is_archived: boolean;
  @ApiProperty() staff_notes: string;
  @ApiProperty({ description: 'IP masked (x.x.x.x)' })
  ip_address: string;
  @ApiProperty() user_agent: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class TimingLeadListResponseDto {
  @ApiProperty({ type: [TimingLeadResponseDto] })
  items: TimingLeadResponseDto[];

  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}

export class TimingLeadCreateResponseDto {
  @ApiProperty() success: boolean;
  @ApiProperty() lead_number: number;
}
