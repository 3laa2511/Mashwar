import 'dotenv/config';
import { closeDb, isPostgresConfigured } from '../src/database/db.js';
import { runMigrations } from '../src/database/migrator.js';

if (!isPostgresConfigured()) {
  console.error('[Mashwar DB] DATABASE_URL is missing. No database was changed.');
  process.exit(1);
}

try {
  const report = await runMigrations();
  console.log(
    report.migrationsExecuted.length
      ? `[Mashwar DB] Applied: ${report.migrationsExecuted.join(', ')}`
      : '[Mashwar DB] Database schema is already up to date.'
  );
} catch (error) {
  console.error('[Mashwar DB] Migration failed; transaction rolled back:', error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
