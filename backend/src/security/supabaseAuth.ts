import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from './rbac.js';

export type VerifiedPrincipal = {
  userId: string;
  role: UserRole;
};

type SupabaseUserResponse = {
  id?: unknown;
  app_metadata?: { role?: unknown } | null;
};

const VALID_ROLES = new Set<UserRole>([
  'owner',
  'operations_dispatcher',
  'support_agent',
  'captain',
  'customer',
  'merchant',
]);

export type AuthenticatedRequest = Request & { auth?: VerifiedPrincipal };

/**
 * Verifies the access token against Supabase Auth's user endpoint.
 * Roles are read only from app_metadata, never user_metadata or request data.
 * If auth is not configured, protected routes remain fail-closed.
 */
export async function attachSupabasePrincipal(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.header('authorization');
  if (!authorization) {
    next();
    return;
  }

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (!match) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_AUTHORIZATION', message: 'بيانات تسجيل الدخول غير صالحة.' },
    });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({
      success: false,
      error: { code: 'AUTH_PROVIDER_NOT_CONFIGURED', message: 'خدمة تسجيل الدخول غير مهيأة.' },
    });
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${match[1]}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401 || response.status === 403) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_OR_EXPIRED_TOKEN', message: 'جلسة تسجيل الدخول غير صالحة أو انتهت.' },
      });
      return;
    }

    if (!response.ok) {
      res.status(503).json({
        success: false,
        error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'تعذر التحقق من جلسة تسجيل الدخول.' },
      });
      return;
    }

    const user = await response.json() as SupabaseUserResponse;
    const userId = typeof user.id === 'string' ? user.id.trim() : '';
    const role = user.app_metadata?.role;

    if (!userId || typeof role !== 'string' || !VALID_ROLES.has(role as UserRole)) {
      res.status(403).json({
        success: false,
        error: { code: 'ROLE_NOT_PROVISIONED', message: 'الحساب غير مهيأ بصلاحية معتمدة.' },
      });
      return;
    }

    (req as AuthenticatedRequest).auth = { userId, role: role as UserRole };
    next();
  } catch {
    res.status(503).json({
      success: false,
      error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'تعذر التحقق من جلسة تسجيل الدخول.' },
    });
  }
}
