/**
 * Mashwar — Kysely Database Connection & Client Provider
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 */

import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { Database } from './schema.js';
import * as migration001 from './migrations/001_security_hardening.js';

const { Pool } = pg;

let dbInstance: Kysely<Database> | null = null;
let pgPoolInstance: pg.Pool | null = null;

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export function getDb(): Kysely<Database> | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  if (!dbInstance) {
    const requiresTls =
      process.env.NODE_ENV === 'production' ||
      connectionString.toLowerCase().includes('supabase');
    const ca = process.env.PG_SSL_CA;

    pgPoolInstance = new Pool({
      connectionString,
      // Production and Supabase connections must validate the server certificate.
      // Provide PG_SSL_CA when the provider uses a private/non-system CA.
      ssl: requiresTls
        ? {
            rejectUnauthorized: true,
            ...(ca ? { ca } : {}),
          }
        : false,
      max: Number(process.env.PG_MAX_POOL || 20),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    dbInstance = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: pgPoolInstance,
      }),
    });
  }

  return dbInstance;
}

export function setCustomDb(customDb: Kysely<Database> | null): void {
  dbInstance = customDb;
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
  }
  if (pgPoolInstance) {
    await pgPoolInstance.end();
    pgPoolInstance = null;
  }
}

export async function runSecurityHardeningMigrations(db: Kysely<Database>): Promise<void> {
  await migration001.up(db);
}
