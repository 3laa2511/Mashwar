/**
 * Mashwar — Immutable Audit Logging & Operational Ledger
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 */

import crypto from 'node:crypto';
import { UserRole } from './rbac.js';

export type AuditActionType =
  | 'PRICING_CONFIG_UPDATED'
  | 'ZONE_TARIFF_UPDATED'
  | 'SYSTEM_SETTINGS_UPDATED'
  | 'CAPTAIN_CASH_SETTLED'
  | 'CAPTAIN_SUBSCRIPTION_RENEWED'
  | 'CAPTAIN_STATUS_OVERRIDE'
  | 'MANUAL_DISPATCH_ASSIGNMENT'
  | 'ORDER_EMERGENCY_CANCELLED'
  | 'STORE_STATUS_UPDATED'
  | 'MENU_ITEM_UPDATED'
  | 'COMPLAINT_CREATED'
  | 'COMPLAINT_ASSIGNED'
  | 'COMPLAINT_RESOLVED'
  | 'SECURITY_VIOLATION_BLOCKED';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601
  actorId: string;
  actorRole: UserRole;
  actorName: string;
  actionType: AuditActionType;
  targetEntity: 'order' | 'captain' | 'pricing' | 'system_settings' | 'security' | 'store' | 'zone' | 'complaint';
  targetId: string;
  descriptionAr: string;
  previousState?: any;
  newState?: any;
  ipAddress?: string;
  notes?: string;
}

export class AuditLogger {
  private static logs: AuditLogEntry[] = [];

  /**
   * Records an immutable entry into the operations ledger.
   */
  public static record(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const log: AuditLogEntry = {
      ...entry,
      id: `audit_${crypto.randomBytes(8).toString('hex')}`,
      timestamp: new Date().toISOString(),
    };

    // Prepend so the newest logs appear first
    this.logs.unshift(Object.freeze({ ...log }));
    return log;
  }

  /**
   * Queries audit logs with optional filtering.
   */
  public static query(filters?: {
    actionType?: AuditActionType;
    targetEntity?: string;
    actorRole?: UserRole;
    limit?: number;
  }): AuditLogEntry[] {
    let result = [...this.logs];

    if (filters?.actionType) {
      result = result.filter((l) => l.actionType === filters.actionType);
    }
    if (filters?.targetEntity) {
      result = result.filter((l) => l.targetEntity === filters.targetEntity);
    }
    if (filters?.actorRole) {
      result = result.filter((l) => l.actorRole === filters.actorRole);
    }

    if (filters?.limit && filters.limit > 0) {
      result = result.slice(0, filters.limit);
    }

    return result;
  }

  /**
   * Returns total count of audit logs.
   */
  public static count(): number {
    return this.logs.length;
  }

  /**
   * Clears in-memory logs (for testing isolation only).
   */
  public static resetForTesting(): void {
    this.logs = [];
  }
}
