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
    // Race Ops — default tenant cho public endpoints (single-tenant MVP).
    OPS_DEFAULT_TENANT_ID: Joi.string().default('5bib-default'),
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
  ops: {
    defaultTenantId: envVars.OPS_DEFAULT_TENANT_ID as string,
  },
};
