import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'test', 'production')
        .default('development'),

    PORT: Joi.number().default(3000),

    DATABASE_URL: Joi.string()
        .uri({ scheme: ['postgres', 'postgresql'] })
        .required(),

    JWT_SECRET: Joi.string()
        .min(32)
        .required(),

    JWT_REFRESH_SECRET: Joi.string()
        .min(32)
        .required(),

    JWT_EXPIRES_IN: Joi.string()
        .default('15m'),

    JWT_REFRESH_EXPIRES_IN: Joi.string()
        .default('30d'),

    FRONTEND_URL: Joi.string()
        .uri()
        .required(),
});