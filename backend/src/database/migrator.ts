/** Mashwar PostgreSQL migration registry with durable, transactional history. */

import { Kysely, DummyDriver, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler, sql } from 'kysely';
import { getDb, isPostgresConfigured } from './db.js';
import * as migration001 from './migrations/001_security_hardening.js';
import * as migration002 from './migrations/002_complete_platform_schema.js';
import { Database } from './schema.js';

export interface MigrationExecutionReport {
  mode: 'live_postgres' | 'dry_run_compiled_sql';
  migrationsExecuted: string[];
  compiledStatementsCount: number;
  sampleSqlStatements: string[];
}

export const MIGRATIONS = [
  { name: '001_security_hardening', up: migration001.up, down: migration001.down },
  { name: '002_complete_platform_schema', up: migration002.up, down: migration002.down },
];

/**
 * Applies pending migrations once, in order. Each migration and its history row
 * commit atomically. A transaction-scoped advisory lock serializes deploys.
 */
export async function runMigrations(): Promise<MigrationExecutionReport> {
  if (!isPostgresConfigured()) {
    throw new Error('DATABASE_URL is required to run database migrations.');
  }

  const db = getDb() as Kysely<any> | null;
  if (!db) throw new Error('PostgreSQL connection could not be initialized.');

  await db.schema
    .createTable('schema_migrations')
    .ifNotExists()
    .addColumn('name', 'varchar(160)', (column) => column.primaryKey())
    .addColumn('applied_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  const executed: string[] = [];
  for (const migration of MIGRATIONS) {
    const applied = await db.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(hashtext('mashwar:schema_migrations'))`.execute(trx);

      const existing = await trx
        .selectFrom('schema_migrations')
        .select('name')
        .where('name', '=', migration.name)
        .executeTakeFirst();

      if (existing) return false;

      await migration.up(trx);
      await trx
        .insertInto('schema_migrations')
        .values({ name: migration.name })
        .execute();
      return true;
    });

    if (applied) executed.push(migration.name);
  }

  return {
    mode: 'live_postgres',
    migrationsExecuted: executed,
    compiledStatementsCount: executed.length,
    sampleSqlStatements: [],
  };
}

/** Refuse API startup when a configured database has pending migrations. */
export async function assertMigrationsCurrent(): Promise<void> {
  if (!isPostgresConfigured()) {
    throw new Error('DATABASE_URL is required for the production API runtime.');
  }
  const db = getDb() as Kysely<any> | null;
  if (!db) throw new Error('PostgreSQL connection could not be initialized.');

  const relation = await sql<{ table_name: string | null }>`select to_regclass('public.schema_migrations')::text as table_name`.execute(db);
  if (!relation.rows[0]?.table_name) {
    throw new Error('Database schema is not initialized. Run `bun run db:migrate` before starting Mashwar.');
  }

  const appliedRows = await db.selectFrom('schema_migrations').select('name').execute();
  const applied = new Set(appliedRows.map((row: { name: string }) => row.name));
  const pending = MIGRATIONS.map((migration) => migration.name).filter((name) => !applied.has(name));
  if (pending.length) {
    throw new Error(`Database has pending migrations: ${pending.join(', ')}. Run `bun run db:migrate` before starting Mashwar.`);
  }
}

/** Compile migration DDL without connecting to or mutating a database. */
export async function verifyOrRunMigrations(runAgainstLiveDb: boolean = false): Promise<MigrationExecutionReport> {
  if (runAgainstLiveDb) return runMigrations();

  const capturedSql: string[] = [];
  class CapturingDriver extends DummyDriver {
    async acquireConnection() {
      return {
        executeQuery: async (compiledQuery: { sql: string; parameters: readonly unknown[] }) => {
          capturedSql.push(compiledQuery.sql);
          return { rows: [] };
        },
        streamQuery: async function* () {},
      };
    }
  }

  const dryRunDb = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new CapturingDriver(),
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  const executed: string[] = [];
  for (const migration of MIGRATIONS) {
    await migration.up(dryRunDb);
    executed.push(migration.name);
  }

  return {
    mode: 'dry_run_compiled_sql',
    migrationsExecuted: executed,
    compiledStatementsCount: capturedSql.length,
    sampleSqlStatements: capturedSql.slice(0, 8),
  };
}
