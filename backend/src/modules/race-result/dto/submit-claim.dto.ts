import { IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitClaimDto {
  @ApiProperty({ description: 'Race ID', example: '6651a...' })
  @IsString()
  raceId: string;

  @ApiProperty({ description: 'Course ID', example: '708' })
  @IsString()
  courseId: string;

  @ApiProperty({ description: 'Bib number', example: '1234' })
  @IsString()
  bib: string;

  @ApiProperty({ description: 'Claimant name', example: 'Nguyen Van A' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Claimant email', example: 'runner@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Claim description / reason',
    example: 'My chip time is incorrect, it should be 3:45:00',
  })
  @IsString()
  description: string;
}
