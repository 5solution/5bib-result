// build: 2026-04-22
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as morgan from 'morgan';

// Set up your API key

import { env } from './config';
import { AppModule } from './modules/app.module';

const setMiddleware = (app: NestExpressApplication) => {
  app.use(express.json({ limit: '512kb' }));
  app.use(express.urlencoded({ extended: true, limit: '512kb' }));

  app.use(helmet());

  // CORS whitelist — Option D defense-in-depth. Server-side fetches (no Origin
  // header) and curl always pass; only browser-side requests from random
  // domains are blocked. Server-side scrape still requires X-API-Key (separate
  // guard on widget endpoints).
  const ALLOWED_ORIGINS = new Set<string>([
    'https://5bib.com',
    'https://www.5bib.com',
    'https://hotro.5bib.com',
    'https://news.5bib.com',
    'https://5sport.vn',
    'https://www.5sport.vn',
    'https://admin.5bib.com',
    'https://result.5bib.com',
    'https://result-admin-dev.5bib.com',
    'https://result-fe-dev.5bib.com',
    'https://hotro-dev.5bib.com',
  ]);
  // Permit all localhost dev ports
  const isLocalDev = (o: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

  app.enableCors({
    credentials: true,
    origin: (origin, callback) => {
      // No Origin = server-to-server / curl / mobile / RSS reader → allow.
      // X-API-Key guard still applies for widget endpoints.
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.has(origin) || isLocalDev(origin)) {
        return callback(null, true);
      }
      // Reject without throwing — sends response with no
      // Access-Control-Allow-Origin header so browser blocks the request,
      // but the server returns a normal 2xx/4xx (not 500). Throwing inside
      // the cors middleware bubbles up as an unhandled exception → 500.
      callback(null, false);
    },
    allowedHeaders: [
      '*',
      'Authorization',
      'Content-Type',
      'X-Requested-With',
      'X-API-Key',
      'Wallet-Address',
      'wallet-address',
    ],
    // Allow browsers to read custom response headers used by the Result Image
    // Creator (template-fallback signal + cache provenance + retry hint).
    exposedHeaders: [
      'X-Template-Fallback',
      'X-Template-Fallback-Reason',
      'X-Template-Actual',
      'X-From-Cache',
      'Retry-After',
    ],
  });

  app.use(morgan('combined'));

  app.use(compression());

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new Logger('[]'),
  });
  app.useLogger(new Logger('APP'));
  const logger = new Logger('APP');

  app.setGlobalPrefix('api');
  setMiddleware(app);

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('5bib result API')
      .setDescription('API documentation for 5bib result service')
      .setVersion('1.1')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
      deepScanRoutes: true,
    });
    SwaggerModule.setup('swagger', app, swaggerDocument, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
    });

    app.use('/swagger/json', (req, res) => {
      res.json(swaggerDocument);
    });
  }

  await app.startAllMicroservices();

  await app.listen(env.port, () => {
    logger.warn(`> Listening App on port ${env.port}`);
    console.log(`> Docs in http://localhost:${env.port}/swagger`);
  });
}

bootstrap();
