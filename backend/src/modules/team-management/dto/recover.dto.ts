import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

/**
 * Step 1 — TNV requests an OTP by submitting email + Turnstile token.
 *
 * Response is ALWAYS 200 with { ok: true, sent_to: <masked-email> } regardless
 * of whether the email exists in DB — prevents account enumeration.
 */
export class RequestRecoverOtpDto {
  @ApiProperty({ example: 'tnv@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    description:
      'Cloudflare Turnstile response token from the <cf-turnstile> widget. Required in production.',
  })
  @IsString()
  @MaxLength(2048)
  turnstile_token!: string;
}

export class RequestRecoverOtpResponseDto {
  @ApiProperty({ description: 'Always true. Does NOT confirm email exists.' })
  ok!: boolean;

  @ApiProperty({
    description:
      'Email with middle part masked (e.g. "ab***@example.com"). Echo-back of user input, safe to display.',
  })
  sent_to!: string;
}

/**
 * Step 2 — TNV submits the 6-digit OTP received by email.
 *
 * On success returns all active (non-terminated) registrations tied to this
 * email with their magic links. On failure throws 400 with generic message
 * "OTP không hợp lệ hoặc đã hết hạn" — do NOT distinguish wrong vs expired
 * vs rate-limited, to avoid oracle attacks.
 */
export class VerifyRecoverOtpDto {
  @ApiProperty({ example: 'tnv@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: '123456', description: '6-digit numeric OTP' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp!: string;
}

export class RecoveredRegistrationDto {
  @ApiProperty() event_id!: number;
  @ApiProperty() event_name!: string;
  @ApiProperty() role_name!: string;
  @ApiProperty() full_name!: string;
  @ApiProperty() status!: string;
  @ApiProperty({
    description: 'Full crew-portal URL. Opens /status/<token>.',
  })
  magic_link!: string;
}

export class VerifyRecoverOtpResponseDto {
  @ApiProperty({ type: [RecoveredRegistrationDto] })
  registrations!: RecoveredRegistrationDto[];
}
