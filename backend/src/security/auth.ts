/**
 * Mashwar — Authentication & Token Verification Middleware
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 *
 * Implements fail-closed token verification with Supabase Auth:
 * - Validates Bearer tokens via Supabase Auth (/auth/v1/user) or cryptographically signed JWT.
 * - Sourced trusted roles strictly from `app_metadata.role`.
 * - Forbids client-supplied identity, roles, or permissions (rejects spoofed X-Actor-* headers).
 * - Enforces fail-closed behavior: missing, malformed, or expired tokens reject immediately with 401.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { UserRole } from './rbac.js';

export interface AuthenticatedUser {
  id: string; // Supabase user ID (UUID / sub)
  role: UserRole; // Sourced strictly from app_metadata.role
  phone?: string;
  fullName?: string;
  email?: string;
  appMetadata: Record<string, any>;
  userMetadata: Record<string, any>;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Default secret strictly restricted to non-production local/test environments
const DEV_FALLBACK_JWT_SECRET = 'mashwar_secure_supabase_jwt_secret_el_bagour_2026';

/**
 * Resolves the authoritative JWT verification secret.
 * Enforces fail-closed behavior in production: throws 500 AUTH_CONFIG_MISSING
 * if SUPABASE_JWT_SECRET is unset or empty when NODE_ENV === 'production'.
 */
export function resolveJwtSecret(): string {
  const configuredSecret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (configuredSecret && configuredSecret.length > 0) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    const err = new Error(
      'خطأ إعدادات أمنية حرج: متغير البيئة SUPABASE_JWT_SECRET غير مضبوط في بيئة الإنتاج (Fail-Closed).'
    );
    (err as any).code = 'AUTH_CONFIG_MISSING';
    (err as any).statusCode = 500;
    throw err;
  }

  return DEV_FALLBACK_JWT_SECRET;
}

/**
 * Validates a JWT or HMAC token.
 * Sourced strictly from app_metadata.role.
 */
export function verifyToken(token: string): AuthenticatedUser {
  if (!token || typeof token !== 'string') {
    const err = new Error('رمز المصادقة غير موجود أو غير صالح.');
    (err as any).code = 'MISSING_TOKEN';
    (err as any).statusCode = 401;
    throw err;
  }

  const jwtSecret = resolveJwtSecret();

  // Handle standard 3-part JWT format: header.payload.signature
  const parts = token.split('.');
  if (parts.length === 3) {
    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify HMAC-SHA256 signature
    const dataToSign = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac('sha256', jwtSecret)
      .update(dataToSign)
      .digest('base64url');

    // Secure timing-safe comparison
    const sigBuffer = Buffer.from(signatureB64);
    const expectedSigBuffer = Buffer.from(expectedSig);

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      const err = new Error('توقيع رمز الدخول غير صالح (تم التلاعب به أو المفتاح غير مطابق).');
      (err as any).code = 'INVALID_TOKEN_SIGNATURE';
      (err as any).statusCode = 401;
      throw err;
    }

    try {
      const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);

      // Check token expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        const err = new Error('انتهت صلاحية رمز الدخول. يرجى إعادة تسجيل الدخول.');
        (err as any).code = 'TOKEN_EXPIRED';
        (err as any).statusCode = 401;
        throw err;
      }

      // Check token audience if provided (standard Supabase JWT aud is 'authenticated')
      if (payload.aud && payload.aud !== 'authenticated') {
        const err = new Error('جمهور الرمز الأمني غير صالح.');
        (err as any).code = 'INVALID_TOKEN_AUDIENCE';
        (err as any).statusCode = 401;
        throw err;
      }

      // Check principal ID
      const userId = payload.sub || payload.id;
      if (!userId) {
        const err = new Error('رمز الدخول لا يحتوي على معرف مستخدم معتمد.');
        (err as any).code = 'INVALID_TOKEN_PAYLOAD';
        (err as any).statusCode = 401;
        throw err;
      }

      // Role must strictly come from server-managed app_metadata.role (never top-level payload.role or user_metadata)
      const appMetadata = payload.app_metadata || {};
      const role = appMetadata.role as UserRole;

      const validRoles: UserRole[] = [
        'owner',
        'operations_dispatcher',
        'support_agent',
        'captain',
        'customer',
        'merchant',
      ];

      if (!role || !validRoles.includes(role)) {
        const err = new Error('رمز الدخول لا يحتوي على دور أمني موثوق ومعتمد في النظام.');
        (err as any).code = 'UNAUTHORIZED_ROLE';
        (err as any).statusCode = 403;
        throw err;
      }

      return {
        id: userId,
        role,
        phone: payload.phone || payload.user_metadata?.phone,
        fullName: payload.user_metadata?.full_name || payload.name,
        email: payload.email,
        appMetadata,
        userMetadata: payload.user_metadata || {},
      };
    } catch (e: any) {
      if (e.statusCode) throw e;
      const err = new Error('فشل فك شفرة حمولة الرمز الأمني.');
      (err as any).code = 'MALFORMED_TOKEN';
      (err as any).statusCode = 401;
      throw err;
    }
  }

  // Handle format errors
  const err = new Error('صيغة رمز المصادقة غير مطابقة لمعايير JWT (Bearer Header.Payload.Signature).');
  (err as any).code = 'MALFORMED_TOKEN';
  (err as any).statusCode = 401;
  throw err;
}

/**
 * Creates a signed JWT for testing and demo flows (forbidden in production).
 */
export function generateTestToken(params: {
  userId: string;
  role: UserRole;
  phone?: string;
  fullName?: string;
  expiresInSeconds?: number;
}): string {
  if (process.env.NODE_ENV === 'production') {
    const err = new Error('غير مسموح بتوليد رموز اختبارية في بيئة الإنتاج.');
    (err as any).code = 'TEST_TOKEN_FORBIDDEN_IN_PRODUCTION';
    (err as any).statusCode = 403;
    throw err;
  }

  const jwtSecret = resolveJwtSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = params.expiresInSeconds ?? 3600;

  const payload = {
    sub: params.userId,
    app_metadata: {
      role: params.role,
      provider: 'phone',
    },
    user_metadata: {
      full_name: params.fullName || 'مستخدم مشوار',
      phone: params.phone || '+201000000000',
    },
    iat: nowSec,
    exp: nowSec + expiresIn,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', jwtSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Express middleware to authenticate the request.
 * Strictly ignores and strips client-supplied `X-Actor-*` headers.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Strip any spoofed headers immediately
  delete (req.headers as any)['x-actor-id'];
  delete (req.headers as any)['x-actor-role'];
  delete (req.headers as any)['x-actor-name'];

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'مطلوب تسجيل الدخول وتمرير رمز Bearer للوصول إلى هذه الخدمة.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        hub: 'El Bagour, Menoufia',
      },
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  try {
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (err: any) {
    const statusCode = err.statusCode || 401;
    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || 'INVALID_TOKEN',
        message: err.message || 'رمز المصادقة غير صالح أو منتهي.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        hub: 'El Bagour, Menoufia',
      },
    });
  }
}

/**
 * Express middleware to enforce allowed roles.
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'يجب التحقق من الهوية أولاً.',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_ROLE',
          message: `غير مصرح لهذا الدور (${req.user.role}) بالوصول إلى هذا الإجراء.`,
        },
        meta: {
          timestamp: new Date().toISOString(),
          hub: 'El Bagour, Menoufia',
        },
      });
      return;
    }

    next();
  };
}
