/**
 * Mashwar API process entry point.
 *
 * Required secrets are validated by the application configuration before the
 * server starts. Keep credentials in environment/secret management, never here.
 */
import { createServer } from './server.js';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Invalid PORT: expected an integer between 1 and 65535.');
}

const app = createServer();
const server = app.listen(port, host, () => {
  console.log(`Mashwar API listening on ${host}:${port}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error('Mashwar API failed to start:', error.message);
  process.exitCode = 1;
});
