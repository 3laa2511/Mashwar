import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
auth.languageCode = 'ar';
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
      return false;
    }
    return true;
  }
}

void testFirestoreConnection();

/**
 * Normalizes Egyptian mobile numbers (e.g. 01012345678) to E.164 (+201012345678).
 */
export function normalizeEgyptianPhoneE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.substring(2)}`;
  if (digits.startsWith('20') && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+2${digits}`;
  if (digits.length === 10 && digits.startsWith('1')) return `+20${digits}`;
  return `+20${digits}`;
}

export function isValidEgyptianPhone(raw: string): boolean {
  const e164 = normalizeEgyptianPhoneE164(raw);
  return /^\+201[0125][0-9]{8}$/.test(e164);
}

export async function sendFirebasePhoneOtp(
  rawPhone: string,
  recaptchaContainerId: string,
  existingVerifier?: RecaptchaVerifier | null
): Promise<{ confirmationResult: ConfirmationResult; verifier: RecaptchaVerifier; e164: string }> {
  const e164 = normalizeEgyptianPhoneE164(rawPhone);
  let verifier = existingVerifier;
  if (!verifier) {
    verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: 'invisible',
    });
  }
  const confirmationResult = await signInWithPhoneNumber(auth, e164, verifier);
  return { confirmationResult, verifier, e164 };
}

export async function ensureFirebasePhoneUserProfile(user: User, displayName?: string): Promise<void> {
  const userPath = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid: user.uid,
        displayName: (displayName || user.displayName || 'عميل مشوار الباجور').slice(0, 80),
        role: 'customer',
        defaultCityId: 'el_bagour',
        defaultLandmark: 'ميدان المحطة - وسط الباجور',
        cashbackBalancePiasters: 2500,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (user.phoneNumber) {
        payload.phone = user.phoneNumber.slice(0, 24);
      }
      if (user.email) {
        payload.email = user.email.slice(0, 160);
      }
      await setDoc(userRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function syncDeliveryOrderToFirestore(input: {
  orderId: string;
  orderNumber: string;
  storeName: string;
  pickupLandmark: string;
  dropoffLandmark: string;
  itemsSummary: string;
  isRural: boolean;
  distanceKm: number;
  subtotalPiasters: number;
  deliveryFeePiasters: number;
  totalFarePiasters: number;
  paymentMethod: 'cash' | 'wallet' | 'vodafone_cash' | 'instapay';
  serviceType: 'restaurant_store' | 'package' | 'errand';
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const safeId = input.orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const orderPath = `orders/${safeId}`;
  try {
    await setDoc(doc(db, 'orders', safeId), {
      id: safeId,
      orderNumber: input.orderNumber.slice(0, 24),
      customerId: user.uid,
      customerName: (user.displayName || user.phoneNumber || 'عميل الباجور').slice(0, 80),
      serviceType: input.serviceType,
      cityId: 'el_bagour',
      storeNames: [input.storeName.slice(0, 100) || 'مشوار الباجور'],
      pickupLandmark: input.pickupLandmark.slice(0, 140),
      dropoffLandmark: input.dropoffLandmark.slice(0, 140),
      itemsSummary: input.itemsSummary.slice(0, 500),
      isRural: input.isRural,
      scheduledFor: 'now',
      hasVoiceNote: false,
      voiceNoteDurationSec: 0,
      voiceNoteTranscript: '',
      distanceKm: Math.max(0.5, Math.min(75, input.distanceKm)),
      subtotalPiasters: Math.max(0, Math.round(input.subtotalPiasters)),
      deliveryFeePiasters: Math.max(0, Math.round(input.deliveryFeePiasters)),
      cashbackAppliedPiasters: 0,
      totalFarePiasters: Math.max(0, Math.round(input.totalFarePiasters)),
      paymentMethod: input.paymentMethod,
      status: input.serviceType === 'restaurant_store' ? 'created' : 'searching_captain',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, orderPath);
  }
}

export async function syncRideToFirestore(input: {
  rideId: string;
  rideNumber: string;
  vehicleTier: 'tuktuk' | 'scooter' | 'car';
  pickupLandmark: string;
  dropoffLandmark: string;
  distanceKm: number;
  estimatedFarePiasters: number;
  paymentMethod: 'cash' | 'wallet' | 'vodafone_cash' | 'instapay';
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const safeId = input.rideId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ridePath = `rides/${safeId}`;
  try {
    await setDoc(doc(db, 'rides', safeId), {
      id: safeId,
      rideNumber: input.rideNumber.slice(0, 24),
      passengerId: user.uid,
      passengerName: (user.displayName || user.phoneNumber || 'راكب الباجور').slice(0, 80),
      vehicleTier: input.vehicleTier,
      cityId: 'el_bagour',
      pickupLandmark: input.pickupLandmark.slice(0, 140),
      dropoffLandmark: input.dropoffLandmark.slice(0, 140),
      distanceKm: Math.max(0.5, Math.min(75, input.distanceKm)),
      estimatedFarePiasters: Math.max(1000, Math.min(150000, Math.round(input.estimatedFarePiasters))),
      cashbackAppliedPiasters: 0,
      paymentMethod: input.paymentMethod,
      status: 'searching_driver',
      safetySosTriggered: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ridePath);
  }
}

export { firebaseSignOut, onAuthStateChanged, type ConfirmationResult, type RecaptchaVerifier, type User };

