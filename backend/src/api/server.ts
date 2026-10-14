/**
 * Mashwar — Express Application Entry Point
 * Authoritative REST API service for El Bagour delivery platform
 */

import express, { Express } from 'express';
import { router as apiRouter } from './routes.js';

export function createServer(): Express {
  const app = express();

  app.use(express.json());

  // Mount API router
  app.use('/api/v1', apiRouter);

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'حدث خطأ غير متوقع في خادم مشوار.',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  });

  return app;
}
