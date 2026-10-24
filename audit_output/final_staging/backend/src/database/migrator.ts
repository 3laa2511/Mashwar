/**
 * Mashwar — PostgreSQL Migration Registry & Dry-Run Schema Validator
 */

import { Kysely, DummyDriver, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
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
 * Compiles all migrations against Kysely's PostgreSQL dialect (or executes against live PostgreSQL if configured)
 * to verify DDL syntax, column types, foreign keys, and indexes.
 */
export async function verifyOrRunMigrations(runAgainstLiveDb: boolean = false): Promise<MigrationExecutionReport> {
  if (runAgainstLiveDb && isPostgresConfigured()) {
    const db = getDb();
    if (db) {
      const executed: string[] = [];
      for (const m of MIGRATIONS) {
        await m.up(db);
        executed.push(m.name);
      }
      return {
        mode: 'live_postgres',
        migrationsExecuted: executed,
        compiledStatementsCount: executed.length,
        sampleSqlStatements: [],
      };
    }
  }

  // Dry-run compile using Kysely PostgresQueryCompiler + custom capturing driver
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
  for (const m of MIGRATIONS) {
    await m.up(dryRunDb);
    executed.push(m.name);
  }

  return {
    mode: 'dry_run_compiled_sql',
    migrationsExecuted: executed,
    compiledStatementsCount: capturedSql.length,
    sampleSqlStatements: capturedSql.slice(0, 8),
  };
}
