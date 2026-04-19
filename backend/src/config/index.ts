import * as dotenv from 'dotenv';
import * as Joi from 'joi';
dotenv.config();

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string()
      .valid('production', 'development', 'test', 'local', 'staging')
      .required(),
    NETWORK: Joi.string().valid('mainnet', 'testnet').required(),
    PORT: Joi.number().default(3000),
    MONGODB_URL: Joi.string().required(),
    MONGODB_DB_NAME: Joi.string().default('5bib_result'),
    REDIS_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().default('5bib-result-secret'),
    AWS_REGION: Joi.string().default('ap-southeast-1'),
    AWS_ACCESS_KEY_ID: Joi.string().optional().allow(''),
    AWS_SECRET_ACCESS_KEY: Joi.string().optional().allow(''),
    AWS_S3_BUCKET: Joi.string().default('5bib-assets'),
    AWS_S3_CDN_URL: Joi.string().optional().allow(''),
    MAILCHIMP_API_KEY: Joi.string().optional().allow(''),
    // P3/P2 — 5BIB Platform MySQL (readonly)
    PLATFORM_DB_HOST: Joi.string().optional().allow(''),
    PLATFORM_DB_PORT: Joi.number().default(3306),
    PLATFORM_DB_NAME: Joi.string().optional().allow(''),
    PLATFORM_DB_USER: Joi.string().optional().allow(''),
    PLATFORM_DB_PASS: Joi.string().optional().allow(''),
    // Team Management — Volunteer MySQL
    VOLUNTEER_DB_HOST: Joi.string().optional().allow(''),
    VOLUNTEER_DB_PORT: Joi.number().default(3306),
    VOLUNTEER_DB_NAME: Joi.string().optional().allow(''),
    VOLUNTEER_DB_USER: Joi.string().optional().allow(''),
    VOLUNTEER_DB_PASS: Joi.string().optional().allow(''),
    MAGIC_TOKEN_EXPIRES_DAYS: Joi.number().default(7),
    TEAM_S3_BUCKET: Joi.string().default('5sport-media'),
    TEAM_CREW_BASE_URL: Joi.string().default('https://crew.5bib.com'),
    TEAM_EMAIL_FROM: Joi.string().default('info@5bib.com'),
    RATE_LIMIT_TTL_MS: Joi.number().default(60_000),
    RATE_LIMIT_MAX: Joi.number().default(60),
    // Cloudflare Turnstile — optional; if unset the backend skips verification
    // (dev / self-hosted). In prod BOTH keys must be set.
    CLOUDFLARE_TURNSTILE_SITE_KEY: Joi.string().optional().allow(''),
    CLOUDFLARE_TURNSTILE_SECRET_KEY: Joi.string().optional().allow(''),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error != null) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const env = {
  env: envVars.NODE_ENV,
  network: envVars.NETWORK,
  port: envVars.PORT,
  mongodb: {
    url: envVars.MONGODB_URL,
    dbName: envVars.MONGODB_DB_NAME,
  },
  redisUrl: envVars.REDIS_URL,
  privateKey: envVars.PRIVATE_KEY,
  jwtSecret: envVars.JWT_SECRET as string,
  s3: {
    region: envVars.AWS_REGION,
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
    bucket: envVars.AWS_S3_BUCKET,
    cdnUrl: envVars.AWS_S3_CDN_URL,
  },
  mailchimp: {
    apiKey: envVars.MAILCHIMP_API_KEY || '',
  },
  platformDb: {
    host: envVars.PLATFORM_DB_HOST as string | undefined,
    port: envVars.PLATFORM_DB_PORT as number,
    name: envVars.PLATFORM_DB_NAME as string | undefined,
    user: envVars.PLATFORM_DB_USER as string | undefined,
    pass: envVars.PLATFORM_DB_PASS as string | undefined,
  },
  volunteerDb: {
    host: envVars.VOLUNTEER_DB_HOST as string | undefined,
    port: envVars.VOLUNTEER_DB_PORT as number,
    name: envVars.VOLUNTEER_DB_NAME as string | undefined,
    user: envVars.VOLUNTEER_DB_USER as string | undefined,
    pass: envVars.VOLUNTEER_DB_PASS as string | undefined,
  },
  teamManagement: {
    magicTokenDays: envVars.MAGIC_TOKEN_EXPIRES_DAYS as number,
    s3Bucket: envVars.TEAM_S3_BUCKET as string,
    crewBaseUrl: envVars.TEAM_CREW_BASE_URL as string,
    emailFrom: envVars.TEAM_EMAIL_FROM as string,
    rateLimitTtlMs: envVars.RATE_LIMIT_TTL_MS as number,
    rateLimitMax: envVars.RATE_LIMIT_MAX as number,
  },
  turnstile: {
    siteKey: (envVars.CLOUDFLARE_TURNSTILE_SITE_KEY as string) || '',
    secretKey: (envVars.CLOUDFLARE_TURNSTILE_SECRET_KEY as string) || '',
  },
};
