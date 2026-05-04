import { ApiProperty } from '@nestjs/swagger';

/**
 * Tab "Trao giải" — Top 10 per course response.
 */
export class PodiumEntryDto {
  @ApiProperty() rank!: number;
  @ApiProperty() bib!: string;
  @ApiProperty({ nullable: true, type: String }) name!: string | null;
  @ApiProperty({ nullable: true, type: String }) chipTime!: string | null;
  @ApiProperty({ nullable: true, type: String }) gunTime!: string | null;
  @ApiProperty({ nullable: true, type: String }) pace!: string | null;
  @ApiProperty({ nullable: true, type: String }) ageGroup!: string | null;
  @ApiProperty({ nullable: true, type: Number }) ageGroupRank!: number | null;
  @ApiProperty({ nullable: true, type: String }) gender!: string | null;
  @ApiProperty({ nullable: true, type: String }) nationality!: string | null;
  @ApiProperty({ nullable: true, type: String }) club!: string | null;
}

export class PodiumCourseDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty({ nullable: true, type: Number }) distanceKm!: number | null;
  @ApiProperty() finishersCount!: number;
  @ApiProperty({ type: [PodiumEntryDto] }) podium!: PodiumEntryDto[];
}

export class PodiumResponseDto {
  @ApiProperty() raceId!: string;
  @ApiProperty() raceTitle!: string;
  @ApiProperty() raceStatus!: string;
  @ApiProperty() generatedAt!: string;
  @ApiProperty({ type: [PodiumCourseDto] }) courses!: PodiumCourseDto[];
}
