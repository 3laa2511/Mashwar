export type ApiHealth = 'not_configured' | 'online' | 'offline';

const configuredBaseUrl = (import.meta.env.VITE_MASHWAR_API_BASE_URL as string | undefined)?.trim();

export const apiBaseUrl = configuredBaseUrl?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getApiHealth(): ApiHealth {
  if (!apiBaseUrl) return 'not_configured';
  return 'online';
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiBaseUrl) {
    throw new ApiError('خدمة مشوار لسه مش متوصلة بالـ API. الواجهة دي أساس للويب وليست خدمة طلبات جاهزة.', undefined, 'API_NOT_CONFIGURED');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    credentials: 'include',
  });

  const body = await response.json().catch(() => null) as
    | { error?: { message?: string; code?: string }; data?: T }
    | T
    | null;

  if (!response.ok) {
    const parsed = body as { error?: { message?: string; code?: string } } | null;
    throw new ApiError(
      parsed?.error?.message ?? 'حصلت مشكلة في الاتصال. جرّب تاني.',
      response.status,
      parsed?.error?.code,
    );
  }

  return body as T;
}

export type VoiceUploadIntent = {
  uploadUrl: string;
  attachmentId: string;
  expiresAt: string;
};

export async function requestVoiceUploadIntent(orderId: string, file: File): Promise<VoiceUploadIntent> {
  return apiRequest<VoiceUploadIntent>(`/api/v1/orders/${encodeURIComponent(orderId)}/voice-notes/upload-intent`, {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }),
  });
}
