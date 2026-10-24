/**
 * Mashwar — Full-Stack Express + Vite Server Entry Point
 * Serves /api/v1/* authoritative backend endpoints and mounts Vite SPA middleware on port 3000.
 */

import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { router as apiRouter } from './backend/src/api/routes.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Mount Mashwar Authoritative REST API Router
  app.use('/api/v1', apiRouter);

  // Global API error handler
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Mashwar] Full-Stack Server (API /api/v1 + Web UI) listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Mashwar] Failed to start server:', err);
  process.exit(1);
});
