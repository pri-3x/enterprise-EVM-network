import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { corsOrigins, type Env } from './config/env.js';
import { registerRoutes, type RouteDeps } from './routes/routes.js';
import { AppError } from './utils/errors.js';
import { bigintReplacer, fail } from './utils/response.js';

export async function buildApp(env: Env, deps: Omit<RouteDeps, 'env'>): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } } }
        : {}),
      redact: ['req.headers.authorization', 'req.headers["x-api-key"]', '*.privateKey', '*.DEPLOYER_PRIVATE_KEY'],
    },
    disableRequestLogging: false,
    genReqId: () => crypto.randomUUID(),
  });

  app.setSerializerCompiler(() => (data) => JSON.stringify(data, bigintReplacer));

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: corsOrigins(env) });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    allowList: (req) => {
      const path = req.url.split('?')[0] ?? '';
      return path === '/health' || path === '/ready' || path === '/metrics';
    },
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      success: false,
      error: { code: 'RATE_LIMITED', message: `Rate limit exceeded, retry in ${context.after}` },
    }),
  });
  await app.register(swagger, {
    openapi: {
      info: { title: 'Besu Enterprise Network API', version: '0.1.0' },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions.url ?? req.url;
    deps.metrics.httpRequests.inc({ method: req.method, route, status: String(reply.statusCode) });
    deps.metrics.httpDuration.observe({ method: req.method, route }, reply.elapsedTime / 1000);
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      req.log.warn({ code: err.code, err: err.message }, 'request_failed');
      return reply.code(err.statusCode).send(fail(err));
    }
    if (err instanceof ZodError) {
      const wrapped = AppError.invalidRequest('Request validation failed', err.flatten());
      return reply.code(400).send(fail(wrapped));
    }
    const statusCode = (err as { statusCode?: number }).statusCode;
    const rateLimited =
      statusCode === 429 ||
      (err as { error?: { code?: string } }).error?.code === 'RATE_LIMITED';
    if (rateLimited) {
      return reply.code(429).send(err);
    }
    req.log.error({ err }, 'unhandled_error');
    return reply.code(500).send(fail(new AppError('INTERNAL_ERROR', 'Internal server error', 500)));
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send(fail(AppError.notFound('Route not found')));
  });

  await registerRoutes(app, { ...deps, env });
  return app;
}
