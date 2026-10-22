/**
 * Mashwar — Express Application Entry Point
 * Authoritative REST API service for the delivery platform
 */

import express, { Express } from 'express';
import { router as apiRouter } from './routes.js';
import { attachSupabasePrincipal } from '../security/supabaseAuth.js';

export function createServer(): Express {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  // Optional authentication: public routes can proceed without a token;
  // protected routes fail closed unless this middleware attaches a verified principal.
  app.use(attachSupabasePrincipal);

  app.use('/api/v1', apiRouter);

  // Keep internal exception details out of client responses.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const candidate = err as { statusCode?: unknown; code?: unknown };
    const statusCode = typeof candidate?.statusCode === 'number' ? candidate.statusCode : 500;
    const code = typeof candidate?.code === 'string' ? candidate.code : 'INTERNAL_SERVER_ERROR';
    res.status(statusCode).json({
      success: false,
      error: {
        code,
        message: statusCode >= 500
          ? 'حدث خطأ غير متوقع في خادم مشوار.'
          : 'تعذر إتمام الطلب.',
      },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  return app;
}
