import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { MulterError } from 'multer';
import type { Response } from 'express';

/**
 * BUG #4 fix — translate Multer file-size errors to HTTP 413 with safe
 * message instead of leaking the default 500 + stack trace.
 *
 * Other MulterError codes (e.g. LIMIT_UNEXPECTED_FILE) become 400.
 */
@Catch(MulterError)
export class MulterErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(MulterErrorFilter.name);

  catch(exception: MulterError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception.code === 'LIMIT_FILE_SIZE') {
      this.logger.warn(
        `[multer] LIMIT_FILE_SIZE field=${exception.field ?? 'file'}`,
      );
      const err = new PayloadTooLargeException(
        'Uploaded file exceeds the maximum allowed size. Split the CSV or contact admin.',
      );
      const body = err.getResponse();
      res.status(HttpStatus.PAYLOAD_TOO_LARGE).json(body);
      return;
    }

    this.logger.warn(`[multer] ${exception.code} ${exception.message}`);
    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: `Upload error: ${exception.code}`,
    });
  }
}
