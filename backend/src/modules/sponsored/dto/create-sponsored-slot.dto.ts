import {
  IsOptional,
  IsIn,
  IsBoolean,
  IsInt,
  IsISO8601,
  Min,
  Max,
  ValidateIf,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// Validator: display_end_at must be strictly after display_start_at
function IsAfter(property: string, options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAfter',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const other = (args.object as Record<string, unknown>)[args.constraints[0]];
          if (typeof value !== 'string' || typeof other !== 'string') return false;
          return new Date(value).getTime() > new Date(other).getTime();
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be after ${args.constraints[0]}`;
        },
      },
    });
  };
}

export class CreateSponsoredSlotDto {
  @ApiProperty({ enum: ['diamond', 'gold', 'silver'] })
  @IsIn(['diamond', 'gold', 'silver'])
  package_tier: string;

  @ApiPropertyOptional({ default: 99, minimum: 1, maximum: 99 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  @Type(() => Number)
  display_order?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_hero?: boolean;

  @ApiPropertyOptional({ minimum: 3, maximum: 30, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(30)
  @Type(() => Number)
  rotation_interval_seconds?: number;

  @ApiProperty({ example: '2026-04-25T00:00:00.000Z' })
  @IsISO8601()
  display_start_at: string;

  @ApiProperty({ example: '2026-07-25T23:59:59.000Z' })
  @IsISO8601()
  @IsAfter('display_start_at', {
    message: 'display_end_at must be after display_start_at',
  })
  display_end_at: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
