import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Server
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Database
  DATABASE_URL: Joi.string().uri().required().description('PostgreSQL connection string'),

  // Redis
  REDIS_URL: Joi.string().required().description('Redis connection string'),

  // JWT
  JWT_SECRET: Joi.string().min(16).required().description('JWT signing secret'),

  // S3 / MinIO
  S3_ENDPOINT: Joi.string().required().description('S3-compatible endpoint URL'),
  S3_BUCKET: Joi.string().required().description('Default S3 bucket name'),
});
