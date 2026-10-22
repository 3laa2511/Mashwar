/**
 * Mashwar — Express Application Entry Point
 * Authoritative REST API service for the delivery platform
 */

import express, { Express, NextFunction, Request, Response } from 'express';
import { router as apiRouter } from './routes.js';
import { attachSupabasePrincipal, AuthenticatedRequest } from '../security/supabaseAuth.js';

export function createServer(): Express {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  // Public routes may proceed without a token. Protected routes fail closed
  // unless this middleware attaches a principal verified by Supabase Auth.
  app.use(attachSupabasePrincipal);

  // Legacy admin handlers consume X-Actor-* headers. Replace those values
  // from the verified principal before the router can see an admin request.
  app.use('/api/v1/admin', (req: Request, res: Response, next: NextFunction) => {
    const principal = (req as AuthenticatedRequest).auth;
    if (!principal) {
      res.status(401).json({
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'يلزم تسجيل الدخول للوصول إلى الإدارة.' },
      });
      return;
    }

    req.headers['x-actor-id'] = principal.userId;
    req.headers['x-actor-role'] = principal.role;
    req.headers['x-actor-name'] = principal.userId;
    next();
  });

  app.use('/api/v1', apiRouter);

  // Keep internal exception details out of client responses.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
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
