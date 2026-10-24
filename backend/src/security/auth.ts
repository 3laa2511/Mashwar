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

// Isolated test secret permitted ONLY when NODE_ENV === 'test'
const ISOLATED_TEST_JWT_SECRET = 'mashwar_secure_supabase_jwt_secret_el_bagour_2026';

export type SupportedJwtAlgorithm = 'HS256' | 'ES256' | 'RS256';
const SUPPORTED_JWT_ALGORITHMS: SupportedJwtAlgorithm[] = ['HS256', 'ES256', 'RS256'];

function isPlaceholderValue(value: string): boolean {
  const upper = value.toUpperCase();
  return (
    upper.startsWith('CHANGE_ME') ||
    upper.includes('YOUR_PROJECT_REF') ||
    upper.includes('YOUR_SUPABASE_')
  );
}

/**
 * Returns true strictly when running inside an explicitly isolated test environment.
 */
export function isIsolatedTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.MASHWAR_DISABLE_TEST_FALLBACK !== 'true';
}

/**
 * Resolves the authoritative symmetric JWT secret for HS256 verification.
 * Fails closed (500 AUTH_CONFIG_MISSING) in all environments (production, staging,
 * development, or unset NODE_ENV) whenever SUPABASE_JWT_SECRET is missing or a placeholder,
 * except in explicitly isolated test runs (NODE_ENV === 'test').
 */
export function resolveJwtSecret(): string {
  const configuredSecret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (configuredSecret && configuredSecret.length > 0 && !isPlaceholderValue(configuredSecret)) {
    return configuredSecret;
  }

  if (isIsolatedTestEnvironment()) {
    return ISOLATED_TEST_JWT_SECRET;
  }

  const err = new Error(
    'خطأ إعدادات أمنية حرج: متغير البيئة SUPABASE_JWT_SECRET غير مضبوط (Fail-Closed).'
  );
  (err as any).code = 'AUTH_CONFIG_MISSING';
  (err as any).statusCode = 500;
  throw err;
}

/**
 * Resolves the authoritative asymmetric public key (PEM or JWK) for ES256 / RS256 verification.
 * Fails closed (500 AUTH_CONFIG_MISSING) if the public key is not configured or key type mismatches.
 */
export function resolveJwtPublicKey(expectedAlg: 'ES256' | 'RS256'): crypto.KeyObject {
  const configuredPem = process.env.SUPABASE_JWT_PUBLIC_KEY?.trim();
  const configuredJwk = process.env.SUPABASE_JWT_PUBLIC_JWK?.trim();

  if (configuredPem && configuredPem.length > 0 && !isPlaceholderValue(configuredPem)) {
    try {
      const normalizedPem = configuredPem.replace(/\\n/g, '\n');
      const pubKey = crypto.createPublicKey(normalizedPem);
      const expectedKeyType = expectedAlg === 'ES256' ? 'ec' : 'rsa';
      if (pubKey.asymmetricKeyType !== expectedKeyType) {
        const err = new Error(
          `نوع المفتاح العام (${pubKey.asymmetricKeyType}) لا يتطابق مع خوارزمية التوقيع (${expectedAlg}).`
        );
        (err as any).code = 'AUTH_CONFIG_MISSING';
        (err as any).statusCode = 500;
        throw err;
      }
      return pubKey;
    } catch (e: any) {
      if (e.code === 'AUTH_CONFIG_MISSING') throw e;
      const err = new Error('فشل قراءة المفتاح العام SUPABASE_JWT_PUBLIC_KEY للتحقق من التوقيع.');
      (err as any).code = 'AUTH_CONFIG_MISSING';
      (err as any).statusCode = 500;
      throw err;
    }
  }

  if (configuredJwk && configuredJwk.length > 0 && !isPlaceholderValue(configuredJwk)) {
    try {
      const jwkObj = JSON.parse(configuredJwk);
      const pubKey = crypto.createPublicKey({ key: jwkObj, format: 'jwk' });
      const expectedKeyType = expectedAlg === 'ES256' ? 'ec' : 'rsa';
      if (pubKey.asymmetricKeyType !== expectedKeyType) {
        const err = new Error(
          `نوع مفتاح JWK (${pubKey.asymmetricKeyType}) لا يتطابق مع خوارزمية التوقيع (${expectedAlg}).`
        );
        (err as any).code = 'AUTH_CONFIG_MISSING';
        (err as any).statusCode = 500;
        throw err;
      }
      return pubKey;
    } catch (e: any) {
      if (e.code === 'AUTH_CONFIG_MISSING') throw e;
      const err = new Error('فشل قراءة مفتاح SUPABASE_JWT_PUBLIC_JWK للتحقق من التوقيع.');
      (err as any).code = 'AUTH_CONFIG_MISSING';
      (err as any).statusCode = 500;
      throw err;
    }
  }

  const err = new Error(
    `خطأ إعدادات أمنية حرج: المفتاح العام (SUPABASE_JWT_PUBLIC_KEY أو SUPABASE_JWT_PUBLIC_JWK) غير مضبوط للتحقق من خوارزمية ${expectedAlg} (Fail-Closed).`
  );
  (err as any).code = 'AUTH_CONFIG_MISSING';
  (err as any).statusCode = 500;
  throw err;
}

/**
 * Resolves the configured trusted JWT issuer (iss).
 * In production, a trusted issuer MUST be configured via SUPABASE_JWT_ISSUER or SUPABASE_URL;
 * if missing in production, fails closed with 500 AUTH_CONFIG_MISSING.
 */
export function resolveTrustedIssuer(): string | undefined {
  const explicitIssuer = process.env.SUPABASE_JWT_ISSUER?.trim();
  if (explicitIssuer && explicitIssuer.length > 0 && !isPlaceholderValue(explicitIssuer)) {
    return explicitIssuer;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (supabaseUrl && supabaseUrl.length > 0 && !isPlaceholderValue(supabaseUrl)) {
    return `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;
  }

  if (process.env.NODE_ENV === 'production') {
    const err = new Error(
      'خطأ إعدادات أمنية حرج: يجب ضبط مصدر الرمز الموثوق (SUPABASE_JWT_ISSUER أو SUPABASE_URL) في بيئة الإنتاج (Fail-Closed).'
    );
    (err as any).code = 'AUTH_CONFIG_MISSING';
    (err as any).statusCode = 500;
    throw err;
  }

  return undefined;
}

/**
 * Verifies the cryptographic signature of a JWT only AFTER inspecting and validating header.alg.
 * Supports HS256 (HMAC-SHA256), ES256 (ECDSA P-256 + SHA-256 IEEE P1363), and RS256 (RSA + SHA-256).
 */
function verifyJwtSignatureByAlgorithm(
  alg: SupportedJwtAlgorithm,
  signingInput: string,
  signatureB64: string
): void {
  // Check explicit algorithm restriction if configured
  const configuredAlg = process.env.SUPABASE_JWT_ALG?.trim();
  if (configuredAlg && configuredAlg.length > 0 && alg !== configuredAlg) {
    const err = new Error(
      `خوارزمية الرمز (${alg}) غير مطابقة للخوارزمية المعتمدة في الإعدادات (${configuredAlg}).`
    );
    (err as any).code = 'INVALID_TOKEN_ALGORITHM';
    (err as any).statusCode = 401;
    throw err;
  }

  // Prevent algorithm confusion: if an asymmetric public key is configured without a symmetric secret,
  // reject any attempt to downgrade verification to HS256.
  const hasPublicKeyConfig =
    Boolean(process.env.SUPABASE_JWT_PUBLIC_KEY?.trim()) ||
    Boolean(process.env.SUPABASE_JWT_PUBLIC_JWK?.trim());
  const hasSecretConfig =
    Boolean(process.env.SUPABASE_JWT_SECRET?.trim()) &&
    !isPlaceholderValue(process.env.SUPABASE_JWT_SECRET!.trim());

  if (alg === 'HS256' && hasPublicKeyConfig && !hasSecretConfig) {
    const err = new Error(
      'رفض أمني: لا يُسمح بخوارزمية HS256 عند ضبط مفتاح عام غير متماثل (منع هجوم Algorithm Confusion).'
    );
    (err as any).code = 'INVALID_TOKEN_ALGORITHM';
    (err as any).statusCode = 401;
    throw err;
  }

  if (alg === 'HS256') {
    const jwtSecret = resolveJwtSecret();
    const expectedSig = crypto
      .createHmac('sha256', jwtSecret)
      .update(signingInput)
      .digest('base64url');

    const sigBuffer = Buffer.from(signatureB64);
    const expectedSigBuffer = Buffer.from(expectedSig);

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      const err = new Error('توقيع رمز الدخول (HS256) غير صالح.');
      (err as any).code = 'INVALID_TOKEN_SIGNATURE';
      (err as any).statusCode = 401;
      throw err;
    }
    return;
  }

  if (alg === 'ES256') {
    const publicKey = resolveJwtPublicKey('ES256');
    const sigBytes = Buffer.from(signatureB64, 'base64url');
    const isValid = crypto.verify(
      'sha256',
      Buffer.from(signingInput, 'utf8'),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      sigBytes
    );
    if (!isValid) {
      const err = new Error('توقيع رمز الدخول غير المتماثل (ES256) غير صالح.');
      (err as any).code = 'INVALID_TOKEN_SIGNATURE';
      (err as any).statusCode = 401;
      throw err;
    }
    return;
  }

  if (alg === 'RS256') {
    const publicKey = resolveJwtPublicKey('RS256');
    const sigBytes = Buffer.from(signatureB64, 'base64url');
    const isValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(signingInput, 'utf8'),
      publicKey,
      sigBytes
    );
    if (!isValid) {
      const err = new Error('توقيع رمز الدخول غير المتماثل (RS256) غير صالح.');
      (err as any).code = 'INVALID_TOKEN_SIGNATURE';
      (err as any).statusCode = 401;
      throw err;
    }
    return;
  }
}

/**
 * Validates a Supabase JWT token.
 * 1. Parses and validates the JWT header and signing algorithm FIRST (HS256, ES256, RS256).
 * 2. Resolves the required verification key/secret and verifies the cryptographic signature (fails closed if missing).
 * 3. Enforces trusted issuer (required in production), audience, expiration, and app_metadata.role.
 */
export function verifyToken(token: string): AuthenticatedUser {
  if (!token || typeof token !== 'string') {
    const err = new Error('رمز المصادقة غير موجود أو غير صالح.');
    (err as any).code = 'MISSING_TOKEN';
    (err as any).statusCode = 401;
    throw err;
  }

  // Handle standard 3-part JWT format: header.payload.signature
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    const err = new Error('صيغة رمز المصادقة غير مطابقة لمعايير JWT (Bearer Header.Payload.Signature).');
    (err as any).code = 'MALFORMED_TOKEN';
    (err as any).statusCode = 401;
    throw err;
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Step 1: Parse header and verify signing algorithm BEFORE choosing verification implementation
  let header: Record<string, any>;
  try {
    const headerJson = Buffer.from(headerB64, 'base64url').toString('utf8');
    header = JSON.parse(headerJson);
  } catch {
    const err = new Error('فشل فك شفرة ترويسة الرمز الأمني (Header).');
    (err as any).code = 'MALFORMED_TOKEN';
    (err as any).statusCode = 401;
    throw err;
  }

  if (
    !header ||
    typeof header !== 'object' ||
    typeof header.alg !== 'string' ||
    !SUPPORTED_JWT_ALGORITHMS.includes(header.alg as SupportedJwtAlgorithm)
  ) {
    const err = new Error(
      `خوارزمية توقيع الرمز الأمني (${header?.alg ?? 'غير محددة'}) غير مدعومة أو مرفوضة.`
    );
    (err as any).code = 'INVALID_TOKEN_ALGORITHM';
    (err as any).statusCode = 401;
    throw err;
  }

  const alg = header.alg as SupportedJwtAlgorithm;

  // Step 2: Verify cryptographic signature using the algorithm-specific verifier
  verifyJwtSignatureByAlgorithm(alg, `${headerB64}.${payloadB64}`, signatureB64);

  // Step 3: Parse and validate payload claims
  let payload: Record<string, any>;
  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(payloadJson);
  } catch {
    const err = new Error('فشل فك شفرة حمولة الرمز الأمني.');
    (err as any).code = 'MALFORMED_TOKEN';
    (err as any).statusCode = 401;
    throw err;
  }

  if (!payload || typeof payload !== 'object') {
    const err = new Error('حمولة الرمز الأمني غير صالحة.');
    (err as any).code = 'MALFORMED_TOKEN';
    (err as any).statusCode = 401;
    throw err;
  }

  // Step 4: Check token expiration (required numeric exp claim)
  if (
    typeof payload.exp !== 'number' ||
    !Number.isFinite(payload.exp) ||
    Date.now() >= payload.exp * 1000
  ) {
    const err = new Error('انتهت صلاحية رمز الدخول أو أن حقل الانتهاء مفقود. يرجى إعادة تسجيل الدخول.');
    (err as any).code = 'TOKEN_EXPIRED';
    (err as any).statusCode = 401;
    throw err;
  }

  // Step 5: Check trusted issuer (required in production; fails closed if unconfigured in production)
  const configuredIssuer = resolveTrustedIssuer();
  if (process.env.NODE_ENV === 'production' || configuredIssuer !== undefined) {
    if (typeof payload.iss !== 'string' || payload.iss.trim().length === 0 || payload.iss !== configuredIssuer) {
      const err = new Error('مصدر الرمز الأمني (Issuer) مفقود أو غير مطابق للمصدر الموثوق.');
      (err as any).code = 'INVALID_TOKEN_ISSUER';
      (err as any).statusCode = 401;
      throw err;
    }
  } else if (payload.iss !== undefined) {
    const validTestIssuers = ['supabase', 'mashwar-auth'];
    const isSupabaseAuthUrl =
      typeof payload.iss === 'string' &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co\/auth\/v1$/.test(payload.iss);
    if (!validTestIssuers.includes(payload.iss) && !isSupabaseAuthUrl) {
      const err = new Error('مصدر الرمز الأمني (Issuer) غير صالح.');
      (err as any).code = 'INVALID_TOKEN_ISSUER';
      (err as any).statusCode = 401;
      throw err;
    }
  }

  // Step 6: Check token audience (standard Supabase JWT aud is 'authenticated')
  if (payload.aud !== undefined || process.env.NODE_ENV === 'production') {
    const isValidAud =
      payload.aud === 'authenticated' ||
      (Array.isArray(payload.aud) && payload.aud.includes('authenticated'));
    if (!isValidAud) {
      const err = new Error('جمهور الرمز الأمني غير صالح.');
      (err as any).code = 'INVALID_TOKEN_AUDIENCE';
      (err as any).statusCode = 401;
      throw err;
    }
  }

  // Step 7: Check principal ID
  const userId = payload.sub || payload.id;
  if (!userId || typeof userId !== 'string') {
    const err = new Error('رمز الدخول لا يحتوي على معرف مستخدم معتمد.');
    (err as any).code = 'INVALID_TOKEN_PAYLOAD';
    (err as any).statusCode = 401;
    throw err;
  }

  // Step 8: Role must strictly come from server-managed app_metadata.role
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
}

/**
 * Creates a signed JWT strictly for isolated test execution (NODE_ENV === 'test').
 * Forbidden in production, staging, development, or unset NODE_ENV.
 */
export function generateTestToken(params: {
  userId: string;
  role: UserRole;
  phone?: string;
  fullName?: string;
  expiresInSeconds?: number;
  issuer?: string;
  audience?: string;
}): string {
  if (!isIsolatedTestEnvironment()) {
    const err = new Error('غير مسموح بتوليد رموز اختبارية خارج بيئة الاختبار المعزولة (NODE_ENV=test).');
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
    iss: params.issuer ?? process.env.SUPABASE_JWT_ISSUER?.trim() ?? 'supabase',
    aud: params.audience ?? 'authenticated',
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
