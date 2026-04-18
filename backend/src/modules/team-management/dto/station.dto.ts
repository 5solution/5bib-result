import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// v1.6 THAY ĐỔI 1: Station/sub-team CRUD + assignment DTOs.

export const STATION_STATUSES = ['setup', 'active', 'closed'] as const;
export type StationStatus = (typeof STATION_STATUSES)[number];

export const ASSIGNMENT_ROLES = ['crew', 'volunteer'] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export class CreateStationDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  station_name!: string;

  @ApiProperty({ required: false, nullable: true, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  location_description?: string | null;

  // GPS lat range: -90..90, stored as DECIMAL(10,7)
  @ApiProperty({ required: false, nullable: true, example: 21.0285 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  gps_lat?: number | null;

  @ApiProperty({ required: false, nullable: true, example: 105.8542 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  gps_lng?: number | null;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export class UpdateStationDto extends PartialType(CreateStationDto) {}

export class UpdateStationStatusDto {
  @ApiProperty({ enum: STATION_STATUSES })
  @IsEnum(STATION_STATUSES)
  status!: StationStatus;
}

export class CreateAssignmentDto {
  @ApiProperty({ example: 42 })
  @IsInt()
  @Min(1)
  registration_id!: number;

  @ApiProperty({ enum: ASSIGNMENT_ROLES })
  @IsEnum(ASSIGNMENT_ROLES)
  assignment_role!: AssignmentRole;

  @ApiProperty({ required: false, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

// Brief shape used in list/summary responses.
export class AssignmentMemberBriefDto {
  @ApiProperty() assignment_id!: number;
  @ApiProperty() registration_id!: number;
  @ApiProperty() full_name!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ enum: ASSIGNMENT_ROLES })
  assignment_role!: AssignmentRole;
  @ApiProperty({ required: false, nullable: true })
  note!: string | null;
}

export class StationWithAssignmentSummaryDto {
  @ApiProperty() id!: number;
  @ApiProperty() station_name!: string;
  @ApiProperty({ required: false, nullable: true })
  location_description!: string | null;
  @ApiProperty({ required: false, nullable: true })
  gps_lat!: string | null;
  @ApiProperty({ required: false, nullable: true })
  gps_lng!: string | null;
  @ApiProperty({ enum: STATION_STATUSES })
  status!: StationStatus;
  @ApiProperty() sort_order!: number;
  @ApiProperty() is_active!: boolean;
  @ApiProperty({ type: [AssignmentMemberBriefDto] })
  crew!: AssignmentMemberBriefDto[];
  @ApiProperty({ type: [AssignmentMemberBriefDto] })
  volunteers!: AssignmentMemberBriefDto[];
  @ApiProperty() crew_count!: number;
  @ApiProperty() volunteer_count!: number;
  @ApiProperty() has_crew!: boolean;
}

// Response for admin "assignable members" lookup — reuses brief shape minus
// the assignment-specific fields.
export class AssignableMemberDto {
  @ApiProperty() registration_id!: number;
  @ApiProperty() full_name!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() email!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ required: false, nullable: true })
  avatar_url!: string | null;
}

// Public portal response: what a TNV/Crew sees when opening their station page.
export class MyStationDetailDto {
  @ApiProperty() id!: number;
  @ApiProperty() station_name!: string;
  @ApiProperty({ required: false, nullable: true })
  location_description!: string | null;
  @ApiProperty({ required: false, nullable: true })
  gps_lat!: string | null;
  @ApiProperty({ required: false, nullable: true })
  gps_lng!: string | null;
  @ApiProperty({ required: false, nullable: true })
  google_maps_url!: string | null;
  @ApiProperty({ enum: STATION_STATUSES })
  status!: StationStatus;
}

export class MyStationViewDto {
  @ApiProperty({ type: MyStationDetailDto, required: false, nullable: true })
  station!: MyStationDetailDto | null;
  @ApiProperty({ enum: ASSIGNMENT_ROLES, required: false, nullable: true })
  my_assignment_role!: AssignmentRole | null;
  @ApiProperty({ type: [AssignmentMemberBriefDto] })
  crew_list!: AssignmentMemberBriefDto[];
  @ApiProperty({ type: [AssignmentMemberBriefDto] })
  teammate_list!: AssignmentMemberBriefDto[];
}
