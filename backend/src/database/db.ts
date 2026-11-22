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

/**
 * Build an explicit PostgreSQL TLS policy. The Pool ssl option remains authoritative
 * even when sslmode is also present in DATABASE_URL.
 */
export function buildPgSslConfig(
  connectionString: string,
  nodeEnv: string | undefined,
  rawCa: string | undefined,
): false | { rejectUnauthorized: true; ca?: string } {
  const normalizedCa = rawCa?.trim().replace(/\\n/g, '\n');
  let hostname = '';
  let sslMode = '';

  try {
    const parsed = new URL(connectionString);
    hostname = parsed.hostname.toLowerCase();
    sslMode = (parsed.searchParams.get('sslmode') || '').toLowerCase();
  } catch {
    hostname = connectionString.toLowerCase();
  }

  const requiresTls =
    nodeEnv === 'production' ||
    hostname.includes('supabase') ||
    ['require', 'verify-ca', 'verify-full'].includes(sslMode);

  if (!requiresTls) return false;

  return {
    rejectUnauthorized: true,
    ...(normalizedCa ? { ca: normalizedCa } : {}),
  };
}

export function getDb(): Kysely<Database> | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  if (!dbInstance) {
    pgPoolInstance = new Pool({
      connectionString,
      ssl: buildPgSslConfig(connectionString, process.env.NODE_ENV, process.env.PG_SSL_CA),
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
