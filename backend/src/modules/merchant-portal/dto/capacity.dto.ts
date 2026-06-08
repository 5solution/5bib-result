import { ApiProperty } from '@nestjs/swagger';

/** FEATURE-073 — capacity of one ticket type. */
export class CapacityTicketTypeDto {
  @ApiProperty() ticketTypeId!: number;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'Quota (ticket_type.max_participate)' }) quota!: number;
  @ApiProperty({ description: 'Đã bán (quota - remaining)' }) sold!: number;
  @ApiProperty({ description: 'Còn lại (remained_ticket)' }) remaining!: number;
  @ApiProperty({ description: 'Không giới hạn (quota 0/null)' }) unlimited!: boolean;
  @ApiProperty({ description: '% lấp đầy (0..100)' }) pctFilled!: number;
}

/** FEATURE-073 — capacity of one course (aggregate of its ticket types). */
export class CapacityCourseDto {
  @ApiProperty() courseId!: number;
  @ApiProperty() courseName!: string;
  @ApiProperty() quota!: number;
  @ApiProperty() sold!: number;
  @ApiProperty() remaining!: number;
  @ApiProperty() unlimited!: boolean;
  @ApiProperty() pctFilled!: number;
  @ApiProperty({ type: [CapacityTicketTypeDto] }) ticketTypes!: CapacityTicketTypeDto[];
}

/** FEATURE-073 — race capacity (sức chứa từng cự ly). Sorted %filled desc. */
export class RaceCapacityDto {
  @ApiProperty() raceId!: number;
  @ApiProperty({ type: [CapacityCourseDto] }) courses!: CapacityCourseDto[];
}
