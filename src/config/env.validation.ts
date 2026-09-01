import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),

  JWT_SECRET: Joi.string().min(32).required(),

  JWT_REFRESH_SECRET: Joi.string().min(32).required(),

  JWT_EXPIRES_IN: Joi.string().default('15m'),

  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  FRONTEND_URL: Joi.string().uri().required(),

  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),

  RESEND_API_KEY: Joi.string().allow('').optional(),

  EMAIL_FROM: Joi.string().allow('').optional(),

  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),

  S3_ENDPOINT: Joi.string()
    .uri()
    .when('STORAGE_DRIVER', {
      is: 's3',
      then: Joi.required(),
      otherwise: Joi.optional().allow(''),
    }),

  S3_REGION: Joi.string().default('auto'),

  S3_ACCESS_KEY_ID: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),

  S3_SECRET_ACCESS_KEY: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),

  S3_BUCKET_PUBLIC: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),

  S3_BUCKET_PRIVATE: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),

  S3_PUBLIC_URL: Joi.string()
    .uri()
    .when('STORAGE_DRIVER', {
      is: 's3',
      then: Joi.required(),
      otherwise: Joi.optional().allow(''),
    }),
});
