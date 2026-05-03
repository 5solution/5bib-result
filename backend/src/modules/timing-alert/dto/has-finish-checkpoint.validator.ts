import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { CourseCheckpoint } from '../schemas/timing-alert-config.schema';

/**
 * Custom class-validator: `course_checkpoints` map mỗi course phải có entry
 * với `key` = "Finish" (case-insensitive — vendor RR đẩy mixed Case).
 *
 * Lý do: nếu course thiếu Finish checkpoint, miss-detector KHÔNG thể flag
 * Phantom Runner / Missing Finish → silent miss alert. Critical bug.
 *
 * Cũng validate `distance_km` strictly increasing (Start=0 → Finish=max km).
 */
export function HasFinishCheckpoint(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'hasFinishCheckpoint',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (
            typeof value !== 'object' ||
            value === null ||
            Array.isArray(value)
          ) {
            return false;
          }
          const map = value as Record<string, unknown>;
          for (const courseName of Object.keys(map)) {
            const checkpoints = map[courseName];
            if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
              return false;
            }
            // Cast safe — validator nest `IsArray` + `ValidateNested` đã
            // ensure mỗi item có shape {key, distance_km}. Ở đây check semantics.
            const cps = checkpoints as CourseCheckpoint[];
            const hasFinish = cps.some(
              (cp) =>
                typeof cp.key === 'string' &&
                cp.key.toLowerCase() === 'finish',
            );
            if (!hasFinish) return false;

            // distance_km strictly increasing
            for (let i = 1; i < cps.length; i++) {
              if (
                typeof cps[i].distance_km !== 'number' ||
                cps[i].distance_km <= cps[i - 1].distance_km
              ) {
                return false;
              }
            }
          }
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return (
            `${args.property}: mỗi course phải có entry "Finish" cuối + ` +
            `distance_km strictly increasing (Start=0 → Finish=max).`
          );
        },
      },
    });
  };
}
