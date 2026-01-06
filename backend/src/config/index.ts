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
    POSTGRES_URL: Joi.string().required(),
    REDIS_URL: Joi.string().required(),
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
  postgres: {
    url: envVars.POSTGRES_URL,
    testUrl: envVars.POSTGRES_URL + '_test',
    testDbName: 'test',
  },
  redisUrl: envVars.REDIS_URL,
  privateKey: envVars.PRIVATE_KEY,
};
