import { ApiProperty } from '@nestjs/swagger';
import { REGISTRATION_STATUS_VALUES } from '../entities/vol-registration.entity';

// v1.5 THAY ĐỔI 2: Team phone directory — members of my team + leaders of
// other teams. Privacy: members of other teams are NEVER leaked unless the
// caller is a leader themselves.

export class DirectoryMemberDto {
  @ApiProperty() id!: number;
  @ApiProperty() full_name!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() role_name!: string;
  @ApiProperty() is_leader!: boolean;
  @ApiProperty({ enum: REGISTRATION_STATUS_VALUES }) status!: string;
  @ApiProperty({ required: false, nullable: true })
  avatar_url!: string | null;
}

export class LeaderContactDto {
  @ApiProperty() id!: number;
  @ApiProperty() full_name!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() role_name!: string;
  @ApiProperty({ enum: REGISTRATION_STATUS_VALUES }) status!: string;
  // True if contact's role has is_leader_role=TRUE. For the leader-viewer
  // case `team_leaders` also contains non-leader cross-team members, so
  // the UI needs this flag to avoid rendering a 👑 on everyone.
  @ApiProperty() is_leader!: boolean;
}

export class MyTeamDto {
  @ApiProperty() role_name!: string;
  @ApiProperty({ type: [DirectoryMemberDto] })
  members!: DirectoryMemberDto[];
}

export class TeamDirectoryResponseDto {
  @ApiProperty({ type: MyTeamDto })
  my_team!: MyTeamDto;

  @ApiProperty({ type: [LeaderContactDto] })
  team_leaders!: LeaderContactDto[];
}
