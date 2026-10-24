/**
 * Mashwar — Authentication & Token Verification Middleware
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 *
 * Implements fail-closed token verification with Supabase Auth:
 * - Validates Bearer tokens only after inspecting header.alg and enforcing strict algorithm-to-key mapping.
 * - Requires explicit trusted JWT algorithm, verification key, trusted issuer, and audience in production.
 * - Sources trusted roles strictly from `app_metadata.role` (zero trust in user_metadata or top-level claims).
 * - Forbids client-supplied identity, roles, or permissions (strips spoofed X-Actor-* headers).
 * - Avoids leaking sensitive configuration details in client-facing HTTP error responses.
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
const SUPPORTED_JWT_ALGORITHMS: ReadonlyArray<SupportedJwtAlgorithm> = ['HS256', 'ES256', 'RS256'];

function createAuthError(code: string, message: string, statusCode: number): Error {
  const err = new Error(message);
  (err as any).code = code;
  (err as any).statusCode = statusCode;
  return err;
}

function isPlaceholderValue(value: string): boolean {
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  return (
    upper.startsWith('CHANGE_ME') ||
    upper.startsWith('YOUR_') ||
    upper.includes('YOUR_PROJECT_REF') ||
    upper.includes('YOUR_SUPABASE_') ||
    upper === 'REPLACE_ME'
  );
}

/**
 * Detects if a string contains PEM or JWK asymmetric key material so an asymmetric
 * public/private key can never be misinterpreted or reused as an HS256 HMAC secret.
 */
function looksLikeAsymmetricKeyMaterial(value: string): boolean {
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  if (
    upper.includes('-----BEGIN') ||
    upper.includes('PUBLIC KEY-----') ||
    upper.includes('PRIVATE KEY-----')
  ) {
    return true;
  }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return true;
  }
  return false;
}

/**
 * Returns true strictly when running inside an explicitly isolated test environment.
 */
export function isIsolatedTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.MASHWAR_DISABLE_TEST_FALLBACK !== 'true';
}

/**
 * Validates overall JWT algorithm and key configuration for consistency and fail-closed safety.
 * - In production, SUPABASE_JWT_ALG must be explicitly configured ('HS256', 'ES256', or 'RS256').
 * - Rejects unsupported SUPABASE_JWT_ALG values in all environments.
 * - Rejects ambiguous configurations where both symmetric secret and asymmetric public key are set,
 *   or where both PEM and JWK public keys are set simultaneously.
 */
export function resolveExpectedJwtAlgorithm(): SupportedJwtAlgorithm | undefined {
  const rawAlg = process.env.SUPABASE_JWT_ALG?.trim();
  const hasAlg = Boolean(rawAlg && rawAlg.length > 0);

  if (hasAlg) {
    if (isPlaceholderValue(rawAlg!) || !SUPPORTED_JWT_ALGORITHMS.includes(rawAlg as SupportedJwtAlgorithm)) {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        'إعداد خوارزمية التحقق SUPABASE_JWT_ALG غير صالح أو غير مدعوم (Fail-Closed).',
        500
      );
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw createAuthError(
      'AUTH_CONFIG_MISSING',
      'يجب تحديد خوارزمية التحقق المعتمدة SUPABASE_JWT_ALG صراحةً في بيئة الإنتاج (Fail-Closed).',
      500
    );
  }

  const rawSecret = process.env.SUPABASE_JWT_SECRET?.trim();
  const hasSecret = Boolean(rawSecret && rawSecret.length > 0 && !isPlaceholderValue(rawSecret));
  const rawPem = process.env.SUPABASE_JWT_PUBLIC_KEY?.trim();
  const hasPem = Boolean(rawPem && rawPem.length > 0 && !isPlaceholderValue(rawPem));
  const rawJwk = process.env.SUPABASE_JWT_PUBLIC_JWK?.trim();
  const hasJwk = Boolean(rawJwk && rawJwk.length > 0 && !isPlaceholderValue(rawJwk));

  // Ambiguous asymmetric public key sources (both PEM and JWK set simultaneously)
  if (hasPem && hasJwk) {
    throw createAuthError(
      'AUTH_CONFIG_MISSING',
      'تعارض في إعدادات المفاتيح: لا يمكن ضبط SUPABASE_JWT_PUBLIC_KEY و SUPABASE_JWT_PUBLIC_JWK معاً (Fail-Closed).',
      500
    );
  }

  // Ambiguous symmetric + asymmetric key configuration
  if (hasSecret && (hasPem || hasJwk)) {
    throw createAuthError(
      'AUTH_CONFIG_MISSING',
      'تعارض في إعدادات المفاتيح: لا يمكن الجمع بين سر متماثل (HS256) ومفتاح عام غير متماثل (ES256/RS256) في آن واحد (Fail-Closed).',
      500
    );
  }

  const expectedAlg = hasAlg ? (rawAlg as SupportedJwtAlgorithm) : undefined;

  if (expectedAlg === 'HS256' && (hasPem || hasJwk)) {
    throw createAuthError(
      'AUTH_CONFIG_MISSING',
      'تعارض في إعدادات المصادقة: الخوارزمية المعتمدة HS256 لا تقبل مفاتيح عامة غير متماثلة.',
      500
    );
  }

  if ((expectedAlg === 'ES256' || expectedAlg === 'RS256') && hasSecret) {
    throw createAuthError(
      'AUTH_CONFIG_MISSING',
      `تعارض في إعدادات المصادقة: الخوارزمية غير المتماثلة (${expectedAlg}) تتطلب مفتاحاً عاماً وليس سراً متماثلاً.`,
      500
    );
  }

  return expectedAlg;
}

/**
 * Resolves the authoritative symmetric JWT secret for HS256 verification.
 * - Fails closed (500 AUTH_CONFIG_MISSING) in all non-test environments if missing or placeholder.
 * - Strictly forbids asymmetric keys (PEM / JWK) from ever being used as an HS256 secret.
 */
export function resolveJwtSecret(): string {
  const configuredSecret = process.env.SUPABASE_JWT_SECRET?.trim();

  if (configuredSecret && configuredSecret.length > 0) {
    if (isPlaceholderValue(configuredSecret)) {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        'خطأ إعدادات أمنية حرج: قيمة SUPABASE_JWT_SECRET الافتراضية غير صالحة للاستخدام (Fail-Closed).',
        500
      );
    }

    if (looksLikeAsymmetricKeyMaterial(configuredSecret)) {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        'رفض أمني حرج: لا يُسمح باستخدام مفتاح عام/خاص غير متماثل (PEM/JWK) كسر متماثل لخوارزمية HS256.',
        500
      );
    }

    const minLen = process.env.NODE_ENV === 'production' ? 32 : 16;
    if (configuredSecret.length < minLen) {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        'خطأ إعدادات أمنية حرج: طول SUPABASE_JWT_SECRET أقل من الحد الأدنى المسموح به أمنياً (Fail-Closed).',
        500
      );
    }

    return configuredSecret;
  }

  if (isIsolatedTestEnvironment()) {
    return ISOLATED_TEST_JWT_SECRET;
  }

  throw createAuthError(
    'AUTH_CONFIG_MISSING',
    'خطأ إعدادات أمنية حرج: متغير البيئة SUPABASE_JWT_SECRET غير مضبوط (Fail-Closed).',
    500
  );
}

/**
 * Resolves the authoritative asymmetric public key (PEM or JWK) for ES256 / RS256 verification.
 * - ES256 requires a validated EC P-256 (prime256v1) public key.
 * - RS256 requires a validated RSA (>= 2048-bit) public key.
 * - Rejects private keys, malformed keys, or mismatched key types with 500 AUTH_CONFIG_MISSING.
 */
export function resolveJwtPublicKey(expectedAlg: 'ES256' | 'RS256'): crypto.KeyObject {
  const configuredPem = process.env.SUPABASE_JWT_PUBLIC_KEY?.trim();
  const configuredJwk = process.env.SUPABASE_JWT_PUBLIC_JWK?.trim();

  if (configuredPem && configuredPem.length > 0 && !isPlaceholderValue(configuredPem)) {
    const normalizedPem = configuredPem.replace(/\\n/g, '\n');
    if (normalizedPem.toUpperCase().includes('PRIVATE KEY')) {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        'رفض أمني: يجب تزويد مفتاح عام فقط (Public Key) وليس مفتاحاً خاصاً في SUPABASE_JWT_PUBLIC_KEY.',
        500
      );
    }

    let pubKey: crypto.KeyObject;
    try {
      pubKey = crypto.createPublicKey(normalizedPem);
    } catch {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        'فشل قراءة المفتاح العام SUPABASE_JWT_PUBLIC_KEY للتحقق من التوقيع.',
        500
      );
    }

    validatePublicKeyDetails(pubKey, expectedAlg);
    return pubKey;
  }

  if (configuredJwk && configuredJwk.length > 0 && !isPlaceholderValue(configuredJwk)) {
    let jwkObj: Record<string, any>;
    try {
      jwkObj = JSON.parse(configuredJwk);
    } catch {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        'فشل تحليل صيغة JSON لمفتاح SUPABASE_JWT_PUBLIC_JWK.',
        500
      );
    }

    if (!jwkObj || typeof jwkObj !== 'object' || typeof jwkObj.d === 'string') {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        'مفتاح JWK غير صالح أو يحتوي على مركبة مفتاح خاص غير مسموح بها.',
        500
      );
    }

    if (typeof jwkObj.alg === 'string' && jwkObj.alg !== expectedAlg) {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        `حقل alg داخل JWK (${jwkObj.alg}) لا يتطابق مع خوارزمية التحقق (${expectedAlg}).`,
        500
      );
    }

    let pubKey: crypto.KeyObject;
    try {
      pubKey = crypto.createPublicKey({ key: jwkObj as crypto.JsonWebKey, format: 'jwk' });
    } catch {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        'فشل قراءة مفتاح SUPABASE_JWT_PUBLIC_JWK للتحقق من التوقيع.',
        500
      );
    }

    validatePublicKeyDetails(pubKey, expectedAlg);
    return pubKey;
  }

  throw createAuthError(
    'AUTH_CONFIG_MISSING',
    `خطأ إعدادات أمنية حرج: المفتاح العام (SUPABASE_JWT_PUBLIC_KEY أو SUPABASE_JWT_PUBLIC_JWK) غير مضبوط للتحقق من خوارزمية ${expectedAlg} (Fail-Closed).`,
    500
  );
}

function validatePublicKeyDetails(pubKey: crypto.KeyObject, expectedAlg: 'ES256' | 'RS256'): void {
  if (pubKey.type !== 'public') {
    throw createAuthError(
      'AUTH_CONFIG_MISSING',
      'المفتاح المعتمد للتحقق يجب أن يكون مفتاحاً عاماً (public key).',
      500
    );
  }

  if (expectedAlg === 'ES256') {
    const namedCurve = pubKey.asymmetricKeyDetails?.namedCurve;
    if (pubKey.asymmetricKeyType !== 'ec' || namedCurve !== 'prime256v1') {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        `خوارزمية ES256 تتطلب مفتاح EC بمنحنى P-256 (prime256v1) حصراً، ولكن تم ضبط (${pubKey.asymmetricKeyType}/${namedCurve ?? 'unknown'}).`,
        500
      );
    }
    return;
  }

  if (expectedAlg === 'RS256') {
    const modulusLength = pubKey.asymmetricKeyDetails?.modulusLength ?? 0;
    if (pubKey.asymmetricKeyType !== 'rsa' || modulusLength < 2048) {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        `خوارزمية RS256 تتطلب مفتاح RSA بطول 2048 بت على الأقل، ولكن تم ضبط (${pubKey.asymmetricKeyType}/${modulusLength}).`,
        500
      );
    }
  }
}

/**
 * Resolves the configured trusted JWT issuer (iss).
 * In production, a trusted issuer MUST be configured via SUPABASE_JWT_ISSUER or SUPABASE_URL;
 * if missing or placeholder in production, fails closed with 500 AUTH_CONFIG_MISSING.
 */
export function resolveTrustedIssuer(): string | undefined {
  const explicitIssuer = process.env.SUPABASE_JWT_ISSUER?.trim();
  if (explicitIssuer && explicitIssuer.length > 0) {
    if (isPlaceholderValue(explicitIssuer)) {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        'قيمة SUPABASE_JWT_ISSUER الافتراضية غير صالحة (Fail-Closed).',
        500
      );
    }
    return explicitIssuer.replace(/\/+$/, '');
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (supabaseUrl && supabaseUrl.length > 0) {
    if (isPlaceholderValue(supabaseUrl)) {
      if (process.env.NODE_ENV === 'production') {
        throw createAuthError(
          'AUTH_CONFIG_MISSING',
          'قيمة SUPABASE_URL الافتراضية غير صالحة في بيئة الإنتاج (Fail-Closed).',
          500
        );
      }
      return undefined;
    }
    return `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
  }

  if (process.env.NODE_ENV === 'production') {
    throw createAuthError(
      'AUTH_CONFIG_MISSING',
      'خطأ إعدادات أمنية حرج: يجب ضبط مصدر الرمز الموثوق (SUPABASE_JWT_ISSUER أو SUPABASE_URL) في بيئة الإنتاج (Fail-Closed).',
      500
    );
  }

  return undefined;
}

/**
 * Resolves the configured trusted JWT audience (aud).
 * In production, SUPABASE_JWT_AUDIENCE must be explicitly configured (no silent fallback).
 */
export function resolveTrustedAudience(): string {
  const explicitAud = process.env.SUPABASE_JWT_AUDIENCE?.trim();
  if (explicitAud && explicitAud.length > 0) {
    if (isPlaceholderValue(explicitAud)) {
      throw createAuthError(
        'AUTH_CONFIG_MISSING',
        'قيمة SUPABASE_JWT_AUDIENCE الافتراضية غير صالحة (Fail-Closed).',
        500
      );
    }
    return explicitAud;
  }

  if (process.env.NODE_ENV === 'production') {
    throw createAuthError(
      'AUTH_CONFIG_MISSING',
      'خطأ إعدادات أمنية حرج: يجب ضبط جمهور الرمز الموثوق (SUPABASE_JWT_AUDIENCE) صراحةً في بيئة الإنتاج (Fail-Closed).',
      500
    );
  }

  return 'authenticated';
}

/**
 * Verifies the cryptographic signature of a JWT only AFTER inspecting header.alg
 * and enforcing strict algorithm-to-key mapping.
 */
function verifyJwtSignatureByAlgorithm(
  alg: SupportedJwtAlgorithm,
  signingInput: string,
  signatureB64: string
): void {
  const expectedAlg = resolveExpectedJwtAlgorithm();

  // Check explicit algorithm restriction if configured (always required in production)
  if (expectedAlg && alg !== expectedAlg) {
    throw createAuthError(
      'INVALID_TOKEN_ALGORITHM',
      `خوارزمية الرمز (${alg}) غير مطابقة للخوارزمية المعتمدة في الإعدادات (${expectedAlg}).`,
      401
    );
  }

  // Prevent algorithm confusion: if an asymmetric public key is configured,
  // reject any attempt to verify a token using HS256.
  const hasPublicKeyConfig =
    Boolean(process.env.SUPABASE_JWT_PUBLIC_KEY?.trim()) ||
    Boolean(process.env.SUPABASE_JWT_PUBLIC_JWK?.trim());

  if (alg === 'HS256' && hasPublicKeyConfig) {
    throw createAuthError(
      'INVALID_TOKEN_ALGORITHM',
      'رفض أمني: لا يُسمح بخوارزمية HS256 عند ضبط مفتاح عام غير متماثل (منع هجوم Algorithm Confusion).',
      401
    );
  }

  if (alg === 'HS256') {
    const jwtSecret = resolveJwtSecret();
    const expectedSig = crypto
      .createHmac('sha256', jwtSecret)
      .update(signingInput)
      .digest('base64url');

    const sigBuffer = Buffer.from(signatureB64, 'utf8');
    const expectedSigBuffer = Buffer.from(expectedSig, 'utf8');

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      throw createAuthError('INVALID_TOKEN_SIGNATURE', 'توقيع رمز الدخول (HS256) غير صالح.', 401);
    }
    return;
  }

  if (alg === 'ES256') {
    const publicKey = resolveJwtPublicKey('ES256');
    const sigBytes = Buffer.from(signatureB64, 'base64url');
    // JWS ES256 (P-256) signatures are fixed 64-byte IEEE P1363 (r || s)
    if (sigBytes.length !== 64) {
      throw createAuthError('INVALID_TOKEN_SIGNATURE', 'توقيع رمز الدخول غير المتماثل (ES256) غير صالح.', 401);
    }
    const isValid = crypto.verify(
      'sha256',
      Buffer.from(signingInput, 'utf8'),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      sigBytes
    );
    if (!isValid) {
      throw createAuthError('INVALID_TOKEN_SIGNATURE', 'توقيع رمز الدخول غير المتماثل (ES256) غير صالح.', 401);
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
      throw createAuthError('INVALID_TOKEN_SIGNATURE', 'توقيع رمز الدخول غير المتماثل (RS256) غير صالح.', 401);
    }
    return;
  }
}

/**
 * Validates a Supabase JWT token.
 * 1. Parses and validates the JWT header and signing algorithm FIRST (HS256, ES256, RS256).
 * 2. Enforces strict algorithm-to-key mapping and verifies the cryptographic signature (fails closed if missing/ambiguous).
 * 3. Enforces trusted issuer, trusted audience, expiration, and app_metadata.role.
 */
export function verifyToken(token: string): AuthenticatedUser {
  if (!token || typeof token !== 'string') {
    throw createAuthError('MISSING_TOKEN', 'رمز المصادقة غير موجود أو غير صالح.', 401);
  }

  // Handle standard 3-part JWT format: header.payload.signature
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw createAuthError(
      'MALFORMED_TOKEN',
      'صيغة رمز المصادقة غير مطابقة لمعايير JWT (Bearer Header.Payload.Signature).',
      401
    );
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Step 1: Parse header and verify signing algorithm BEFORE choosing verification implementation
  let header: Record<string, any>;
  try {
    const headerJson = Buffer.from(headerB64, 'base64url').toString('utf8');
    header = JSON.parse(headerJson);
  } catch {
    throw createAuthError('MALFORMED_TOKEN', 'فشل فك شفرة ترويسة الرمز الأمني (Header).', 401);
  }

  if (
    !header ||
    typeof header !== 'object' ||
    typeof header.alg !== 'string' ||
    !SUPPORTED_JWT_ALGORITHMS.includes(header.alg as SupportedJwtAlgorithm)
  ) {
    throw createAuthError(
      'INVALID_TOKEN_ALGORITHM',
      `خوارزمية توقيع الرمز الأمني (${header?.alg ?? 'غير محددة'}) غير مدعومة أو مرفوضة.`,
      401
    );
  }

  const alg = header.alg as SupportedJwtAlgorithm;

  // Step 2: Verify cryptographic signature using the strict algorithm-specific verifier
  verifyJwtSignatureByAlgorithm(alg, `${headerB64}.${payloadB64}`, signatureB64);

  // Step 3: Parse and validate payload claims
  let payload: Record<string, any>;
  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(payloadJson);
  } catch {
    throw createAuthError('MALFORMED_TOKEN', 'فشل فك شفرة حمولة الرمز الأمني.', 401);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createAuthError('MALFORMED_TOKEN', 'حمولة الرمز الأمني غير صالحة.', 401);
  }

  // Step 4: Check token expiration (required numeric exp claim)
  if (
    typeof payload.exp !== 'number' ||
    !Number.isFinite(payload.exp) ||
    Date.now() >= payload.exp * 1000
  ) {
    throw createAuthError(
      'TOKEN_EXPIRED',
      'انتهت صلاحية رمز الدخول أو أن حقل الانتهاء مفقود. يرجى إعادة تسجيل الدخول.',
      401
    );
  }

  // Step 5: Check trusted issuer (required in all tokens; server config required in production)
  const configuredIssuer = resolveTrustedIssuer();
  if (typeof payload.iss !== 'string' || payload.iss.trim().length === 0) {
    throw createAuthError(
      'INVALID_TOKEN_ISSUER',
      'مصدر الرمز الأمني (Issuer) مفقود.',
      401
    );
  }

  const normalizedTokenIss = payload.iss.trim().replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production' || configuredIssuer !== undefined) {
    if (normalizedTokenIss !== configuredIssuer) {
      throw createAuthError(
        'INVALID_TOKEN_ISSUER',
        'مصدر الرمز الأمني (Issuer) غير مطابق للمصدر الموثوق.',
        401
      );
    }
  } else {
    const validTestIssuers = ['supabase', 'mashwar-auth'];
    const isSupabaseAuthUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/auth\/v1$/.test(normalizedTokenIss);
    if (!validTestIssuers.includes(normalizedTokenIss) && !isSupabaseAuthUrl) {
      throw createAuthError('INVALID_TOKEN_ISSUER', 'مصدر الرمز الأمني (Issuer) غير صالح.', 401);
    }
  }

  // Step 6: Check trusted audience (required in all tokens; explicit server config required in production)
  const expectedAudience = resolveTrustedAudience();
  const isValidAud =
    payload.aud === expectedAudience ||
    (Array.isArray(payload.aud) && payload.aud.includes(expectedAudience));

  if (!isValidAud) {
    throw createAuthError('INVALID_TOKEN_AUDIENCE', 'جمهور الرمز الأمني (Audience) مفقود أو غير صالح.', 401);
  }

  // Step 7: Check principal ID
  const userId = payload.sub || payload.id;
  if (!userId || typeof userId !== 'string') {
    throw createAuthError('INVALID_TOKEN_PAYLOAD', 'رمز الدخول لا يحتوي على معرف مستخدم معتمد.', 401);
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
    throw createAuthError(
      'UNAUTHORIZED_ROLE',
      'رمز الدخول لا يحتوي على دور أمني موثوق ومعتمد في النظام.',
      403
    );
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
    throw createAuthError(
      'TEST_TOKEN_FORBIDDEN_IN_PRODUCTION',
      'غير مسموح بتوليد رموز اختبارية خارج بيئة الاختبار المعزولة (NODE_ENV=test).',
      403
    );
  }

  const jwtSecret = resolveJwtSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = params.expiresInSeconds ?? 3600;

  const payload = {
    sub: params.userId,
    iss: params.issuer ?? process.env.SUPABASE_JWT_ISSUER?.trim() ?? 'supabase',
    aud: params.audience ?? process.env.SUPABASE_JWT_AUDIENCE?.trim() ?? 'authenticated',
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
 * - Strictly ignores and strips client-supplied `X-Actor-*` headers.
 * - Avoids leaking internal server configuration details on 500 AUTH_CONFIG_MISSING errors.
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
    const isConfigError = statusCode === 500 || err.code === 'AUTH_CONFIG_MISSING';
    const safeClientMessage = isConfigError
      ? 'خطأ في إعدادات خدمة المصادقة بالخادم.'
      : err.message || 'رمز المصادقة غير صالح أو منتهي.';

    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || 'INVALID_TOKEN',
        message: safeClientMessage,
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
