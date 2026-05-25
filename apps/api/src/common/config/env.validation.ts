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
  S3_REGION: Joi.string().default('us-east-1').description('S3 region'),
  S3_ACCESS_KEY: Joi.string().required().description('S3 access key'),
  S3_SECRET_KEY: Joi.string().required().description('S3 secret key'),
  S3_BUCKET: Joi.string().required().description('Default S3 bucket name'),

  // Google OAuth
  GOOGLE_CLIENT_ID: Joi.string().required().description('Google OAuth client ID'),
  GOOGLE_CLIENT_SECRET: Joi.string().required().description('Google OAuth client secret'),
  GOOGLE_CALLBACK_URL: Joi.string()
    .default('http://localhost:8888/api/auth/google/callback')
    .description('Google OAuth callback URL'),

  // Facebook OAuth
  FACEBOOK_APP_ID: Joi.string().required().description('Facebook App ID'),
  FACEBOOK_APP_SECRET: Joi.string().required().description('Facebook App Secret'),
  FACEBOOK_CALLBACK_URL: Joi.string()
    .default('http://localhost:8888/api/auth/facebook/callback')
    .description('Facebook OAuth callback URL'),

  // Telegram Login Widget
  TELEGRAM_BOT_TOKEN: Joi.string().required().description('Telegram Bot Token for Login Widget'),

  // Frontend
  FRONTEND_URL: Joi.string()
    .default('http://localhost:4333')
    .description('Frontend URL for OAuth redirects'),

  // Security
  CORS_ORIGINS: Joi.string()
    .default('http://localhost:4333')
    .description('Comma-separated list of allowed CORS origins'),
});
