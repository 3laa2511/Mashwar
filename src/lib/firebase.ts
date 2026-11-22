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
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocFromServer,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  BLUEPRINT_LIMITS,
  BOOTSTRAPPED_OWNER_EMAIL,
  sanitizeDocId,
  clampStr,
} from './firestoreSchemas';

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
      const referralSuffix = user.uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'BAGOUR';
      const payload: Record<string, unknown> = {
        uid: user.uid,
        displayName: clampStr(displayName || user.displayName || 'عميل مشوار الباجور', BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
        role: 'customer',
        defaultCityId: 'el_bagour',
        defaultLandmark: 'ميدان المحطة - وسط الباجور',
        cashbackBalancePiasters: BLUEPRINT_LIMITS.WELCOME_BONUS_PIASTERS,
        loyaltyPoints: 50,
        referralCode: `MSH-${referralSuffix}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (user.phoneNumber) {
        payload.phone = user.phoneNumber.slice(0, BLUEPRINT_LIMITS.PHONE_MAX);
      }
      if (user.email) {
        payload.email = user.email.slice(0, BLUEPRINT_LIMITS.EMAIL_MAX);
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
  storeNames?: string[];
  storeIds?: string[];
  merchantOwnerUid?: string;
  pickupLandmark: string;
  dropoffLandmark: string;
  itemsSummary: string;
  aiExtractedItems?: string[];
  prescriptionSummary?: string;
  isRural: boolean;
  distanceKm: number;
  subtotalPiasters: number;
  deliveryFeePiasters: number;
  driverTipPiasters?: number;
  discountPiasters?: number;
  promoCode?: string;
  cashChangeForEgp?: 0 | 50 | 100 | 200;
  totalFarePiasters: number;
  paymentMethod: 'cash' | 'wallet' | 'vodafone_cash' | 'instapay';
  serviceType: 'restaurant_store' | 'package' | 'errand' | 'prescription_list';
  initialStatus?: 'created' | 'searching_captain' | 'awaiting_quote';
  scheduledFor?: string | null;
  hasVoiceNote?: boolean;
  voiceNoteDurationSec?: number;
  voiceNoteTranscript?: string;
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const safeId = sanitizeDocId(input.orderId);
  const orderPath = `orders/${safeId}`;
  const cleanTranscript = clampStr(input.voiceNoteTranscript || '', BLUEPRINT_LIMITS.VOICE_TRANSCRIPT_MAX);
  const hasVoice = Boolean(input.hasVoiceNote || cleanTranscript.length > 0);
  const safeDuration = Math.max(0, Math.min(BLUEPRINT_LIMITS.VOICE_DURATION_MAX_SEC, Math.round(input.voiceNoteDurationSec || 0)));
  const safeScheduled = clampStr(input.scheduledFor || 'now', BLUEPRINT_LIMITS.SCHEDULED_FOR_MAX) || 'now';
  const safeStoreNames = (input.storeNames && input.storeNames.length > 0
    ? input.storeNames
    : [input.storeName || 'مشوار الباجور']
  )
    .slice(0, BLUEPRINT_LIMITS.MAX_ORDER_STOPS)
    .map((n) => clampStr(n, BLUEPRINT_LIMITS.STORE_NAME_MAX) || 'مشوار الباجور');

  const safeStatus =
    input.initialStatus ||
    (input.serviceType === 'prescription_list'
      ? 'awaiting_quote'
      : input.serviceType === 'restaurant_store'
      ? 'created'
      : 'searching_captain');

  const payload: Record<string, unknown> = {
    id: safeId,
    orderNumber: clampStr(input.orderNumber, 24),
    customerId: user.uid,
    customerName: clampStr(user.displayName || user.phoneNumber || 'عميل الباجور', BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
    serviceType: input.serviceType,
    cityId: 'el_bagour',
    storeNames: safeStoreNames,
    pickupLandmark: clampStr(input.pickupLandmark, BLUEPRINT_LIMITS.LANDMARK_MAX) || 'ميدان المحطة - الباجور',
    dropoffLandmark: clampStr(input.dropoffLandmark, BLUEPRINT_LIMITS.LANDMARK_MAX) || 'شارع الجيش - الباجور',
    itemsSummary: clampStr(input.itemsSummary, BLUEPRINT_LIMITS.ITEMS_SUMMARY_MAX) || 'طلب توصيل مشوار',
    isRural: input.isRural,
    scheduledFor: safeScheduled,
    hasVoiceNote: hasVoice,
    voiceNoteDurationSec: safeDuration,
    voiceNoteTranscript: cleanTranscript,
    distanceKm: Math.max(0.5, Math.min(BLUEPRINT_LIMITS.MAX_DISTANCE_KM, input.distanceKm)),
    subtotalPiasters: Math.max(0, Math.round(input.subtotalPiasters)),
    deliveryFeePiasters: Math.max(0, Math.round(input.deliveryFeePiasters)),
    driverTipPiasters: Math.max(0, Math.min(50000, Math.round(input.driverTipPiasters || 0))),
    discountPiasters: Math.max(0, Math.min(100000, Math.round(input.discountPiasters || 0))),
    cashChangeForEgp: input.cashChangeForEgp ?? 0,
    cashbackAppliedPiasters: 0,
    totalFarePiasters: Math.max(0, Math.round(input.totalFarePiasters)),
    paymentMethod: input.paymentMethod,
    status: safeStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (input.merchantOwnerUid) {
    payload.merchantOwnerUid = clampStr(input.merchantOwnerUid, BLUEPRINT_LIMITS.ID_MAX);
  }
  if (input.storeIds && input.storeIds.length > 0) {
    payload.storeIds = input.storeIds.slice(0, BLUEPRINT_LIMITS.MAX_ORDER_STOPS).map(sanitizeDocId);
  }
  if (input.aiExtractedItems && input.aiExtractedItems.length > 0) {
    payload.aiExtractedItems = input.aiExtractedItems
      .slice(0, BLUEPRINT_LIMITS.AI_ITEMS_COUNT_MAX)
      .map((item) => clampStr(item, BLUEPRINT_LIMITS.AI_ITEM_MAX));
  }
  if (input.prescriptionSummary) {
    payload.prescriptionSummary = clampStr(input.prescriptionSummary, BLUEPRINT_LIMITS.PRESCRIPTION_SUMMARY_MAX);
  }
  if (input.promoCode) {
    payload.promoCode = clampStr(input.promoCode, BLUEPRINT_LIMITS.PROMO_CODE_MAX);
  }

  try {
    await setDoc(doc(db, 'orders', safeId), payload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, orderPath);
  }
}

export async function updateDeliveryOrderInFirestore(
  orderId: string,
  patch: {
    status?:
      | 'awaiting_quote'
      | 'quote_ready'
      | 'accepted_by_store'
      | 'preparing'
      | 'ready_for_pickup'
      | 'searching_captain'
      | 'captain_assigned'
      | 'at_pickup'
      | 'picked_up'
      | 'in_transit'
      | 'delivered'
      | 'cancelled';
    assignedCaptainId?: string;
    assignedCaptainName?: string;
    quoteTotalPiasters?: number;
    quoteNotes?: string;
    subtotalPiasters?: number;
    driverTipPiasters?: number;
    totalFarePiasters?: number;
  }
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !orderId) return false;
  const safeId = sanitizeDocId(orderId);
  const orderPath = `orders/${safeId}`;
  try {
    const orderRef = doc(db, 'orders', safeId);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) return false;
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.assignedCaptainId !== undefined) payload.assignedCaptainId = patch.assignedCaptainId;
    if (patch.assignedCaptainName !== undefined) {
      payload.assignedCaptainName = clampStr(patch.assignedCaptainName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);
    }
    if (patch.quoteTotalPiasters !== undefined) {
      payload.quoteTotalPiasters = Math.max(0, Math.round(patch.quoteTotalPiasters));
    }
    if (patch.quoteNotes !== undefined) {
      payload.quoteNotes = clampStr(patch.quoteNotes, BLUEPRINT_LIMITS.QUOTE_NOTES_MAX);
    }
    if (patch.subtotalPiasters !== undefined) {
      payload.subtotalPiasters = Math.max(0, Math.round(patch.subtotalPiasters));
    }
    if (patch.driverTipPiasters !== undefined) {
      payload.driverTipPiasters = Math.max(0, Math.min(50000, Math.round(patch.driverTipPiasters)));
    }
    if (patch.totalFarePiasters !== undefined) {
      payload.totalFarePiasters = Math.max(0, Math.round(patch.totalFarePiasters));
    }
    await updateDoc(orderRef, payload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, orderPath);
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
  driverTipPiasters?: number;
  cashChangeForEgp?: 0 | 50 | 100 | 200;
  discountPiasters?: number;
  promoCode?: string;
  ridePin?: string;
  requiresFamilyTrustedDriver?: boolean;
  scheduledFor?: string | null;
  paymentMethod: 'cash' | 'wallet' | 'vodafone_cash' | 'instapay';
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const safeId = sanitizeDocId(input.rideId);
  const ridePath = `rides/${safeId}`;
  const payload: Record<string, unknown> = {
    id: safeId,
    rideNumber: clampStr(input.rideNumber, 24),
    passengerId: user.uid,
    passengerName: clampStr(user.displayName || user.phoneNumber || 'راكب الباجور', BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
    vehicleTier: input.vehicleTier,
    cityId: 'el_bagour',
    pickupLandmark: clampStr(input.pickupLandmark, BLUEPRINT_LIMITS.LANDMARK_MAX),
    dropoffLandmark: clampStr(input.dropoffLandmark, BLUEPRINT_LIMITS.LANDMARK_MAX),
    distanceKm: Math.max(0.5, Math.min(BLUEPRINT_LIMITS.MAX_DISTANCE_KM, input.distanceKm)),
    estimatedFarePiasters: Math.max(1000, Math.min(200000, Math.round(input.estimatedFarePiasters))),
    driverTipPiasters: Math.max(0, Math.min(50000, Math.round(input.driverTipPiasters || 0))),
    cashChangeForEgp: input.cashChangeForEgp ?? 0,
    discountPiasters: Math.max(0, Math.min(100000, Math.round(input.discountPiasters || 0))),
    cashbackAppliedPiasters: 0,
    paymentMethod: input.paymentMethod,
    ridePin: clampStr(input.ridePin || '1234', BLUEPRINT_LIMITS.RIDE_PIN_MAX),
    requiresFamilyTrustedDriver: Boolean(input.requiresFamilyTrustedDriver),
    scheduledFor: clampStr(input.scheduledFor || 'now', BLUEPRINT_LIMITS.SCHEDULED_FOR_MAX) || 'now',
    status: 'searching_driver',
    safetySosTriggered: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.promoCode) {
    payload.promoCode = clampStr(input.promoCode, BLUEPRINT_LIMITS.PROMO_CODE_MAX);
  }
  try {
    await setDoc(doc(db, 'rides', safeId), payload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ridePath);
  }
}

export async function createCommuteSubscriptionInFirestore(input: {
  id: string;
  fromLandmark: string;
  toLandmark: string;
  scheduleDays: string[];
  morningTime: string;
  returnTime?: string;
  vehicleTier: 'tuktuk' | 'car';
  planType: 'weekly' | 'monthly';
  pricePiasters: number;
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const safeId = sanitizeDocId(input.id);
  const path = `commuteSubscriptions/${safeId}`;
  try {
    await setDoc(doc(db, 'commuteSubscriptions', safeId), {
      id: safeId,
      passengerId: user.uid,
      passengerName: clampStr(user.displayName || user.phoneNumber || 'مشترك الباجور', BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      fromLandmark: clampStr(input.fromLandmark, BLUEPRINT_LIMITS.LANDMARK_MAX),
      toLandmark: clampStr(input.toLandmark, BLUEPRINT_LIMITS.LANDMARK_MAX),
      scheduleDays: input.scheduleDays.slice(0, 7),
      morningTime: clampStr(input.morningTime, 12),
      returnTime: clampStr(input.returnTime || '', 12),
      vehicleTier: input.vehicleTier,
      planType: input.planType,
      pricePiasters: Math.max(2000, Math.round(input.pricePiasters)),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function submitWalletTopUpProofInFirestore(input: {
  txId: string;
  amountPiasters: number;
  proofRef: string;
  titleAr: string;
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const safeTxId = sanitizeDocId(input.txId);
  const path = `users/${user.uid}/walletTransactions/${safeTxId}`;
  try {
    await ensureFirebasePhoneUserProfile(user);
    await setDoc(doc(db, 'users', user.uid, 'walletTransactions', safeTxId), {
      id: safeTxId,
      userId: user.uid,
      type: 'topup_proof',
      amountPiasters: Math.max(1000, Math.min(500000, Math.round(input.amountPiasters))),
      refId: sanitizeDocId(input.proofRef),
      proofRef: clampStr(input.proofRef, BLUEPRINT_LIMITS.PROOF_REF_MAX),
      titleAr: clampStr(input.titleAr, 140),
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToOrderStatusInFirestore(
  orderId: string,
  onStatusUpdate: (status: string, data?: Record<string, unknown>) => void
): Unsubscribe {
  const user = auth.currentUser;
  if (!user || !orderId) return () => {};
  const safeId = sanitizeDocId(orderId);
  const orderPath = `orders/${safeId}`;
  return onSnapshot(
    doc(db, 'orders', safeId),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Record<string, unknown>;
        if (typeof data?.status === 'string') {
          onStatusUpdate(data.status, data);
        }
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, orderPath);
    }
  );
}

/**
 * Real-time scoped Firestore feed for Customer, Captain, Merchant, or Bootstrapped Admin.
 * Strictly mirrors firestore.rules allow-list predicates so queries never trigger blanket-read errors.
 */
export function subscribeToScopedOrdersInFirestore(params: {
  role: 'customer' | 'captain' | 'merchant' | 'operations';
  onOrders: (docs: Record<string, unknown>[]) => void;
}): Unsubscribe {
  const user = auth.currentUser;
  if (!user) return () => {};

  const isBootstrappedOwner = Boolean(
    user.emailVerified && user.email === BOOTSTRAPPED_OWNER_EMAIL
  );

  const ordersCol = collection(db, 'orders');
  let q;
  if (isBootstrappedOwner) {
    q = ordersCol;
  } else if (params.role === 'captain') {
    q = query(ordersCol, where('status', 'in', ['ready_for_pickup', 'searching_captain', 'awaiting_quote']));
  } else if (params.role === 'merchant') {
    q = query(ordersCol, where('merchantOwnerUid', '==', user.uid));
  } else {
    q = query(ordersCol, where('customerId', '==', user.uid));
  }

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
      params.onOrders(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    }
  );
}

export function subscribeToCommuteSubscriptionsInFirestore(
  onSubs: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const user = auth.currentUser;
  if (!user) return () => {};
  const isBootstrappedOwner = Boolean(
    user.emailVerified && user.email === BOOTSTRAPPED_OWNER_EMAIL
  );
  const subsCol = collection(db, 'commuteSubscriptions');
  const q = isBootstrappedOwner ? subsCol : query(subsCol, where('passengerId', '==', user.uid));
  return onSnapshot(
    q,
    (snap) => {
      onSubs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'commuteSubscriptions');
    }
  );
}

export async function triggerRideSafetySosInFirestore(rideId: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !rideId) return false;
  const safeId = sanitizeDocId(rideId);
  const ridePath = `rides/${safeId}`;
  try {
    const rideRef = doc(db, 'rides', safeId);
    const snap = await getDoc(rideRef);
    if (!snap.exists()) return false;
    const data = snap.data();
    if (data?.passengerId !== user.uid) return false;
    await updateDoc(rideRef, {
      safetySosTriggered: true,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, ridePath);
  }
}

export function subscribeToStoresFromFirestore(
  onStores: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const user = auth.currentUser;
  if (!user) return () => {};
  const storesQuery = query(collection(db, 'stores'), where('isOpen', 'in', [true, false]));
  return onSnapshot(
    storesQuery,
    (snap) => {
      onStores(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stores');
    }
  );
}

export function subscribeToDriverRatingsFromFirestore(
  onRatings: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const user = auth.currentUser;
  if (!user) return () => {};
  const ratingsQuery = query(
    collection(db, 'driverRatings'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(
    ratingsQuery,
    (snap) => {
      onRatings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'driverRatings');
    }
  );
}

export async function submitDriverRatingToFirestore(input: {
  ratingId: string;
  orderId: string;
  driverId: string;
  driverName: string;
  rating: number;
  tags: string[];
  feedback: string;
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const safeId = sanitizeDocId(input.ratingId);
  const path = `driverRatings/${safeId}`;
  const cleanTags = input.tags
    .map((t) => clampStr(t, BLUEPRINT_LIMITS.RATING_TAG_TEXT_MAX))
    .filter(Boolean)
    .slice(0, BLUEPRINT_LIMITS.RATING_TAGS_MAX);
  try {
    await setDoc(doc(db, 'driverRatings', safeId), {
      id: safeId,
      orderId: sanitizeDocId(input.orderId),
      driverId: sanitizeDocId(input.driverId || 'cpt_02'),
      driverName: clampStr(input.driverName || 'كابتن مشوار', BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      customerId: user.uid,
      rating: Math.max(1, Math.min(5, Math.round(input.rating))),
      tags: cleanTags,
      feedback: clampStr(input.feedback || '', BLUEPRINT_LIMITS.RATING_FEEDBACK_MAX),
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToThreadMessagesInFirestore(
  threadId: string,
  onMessages: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const user = auth.currentUser;
  if (!user || !threadId) return () => {};
  const safeThreadId = sanitizeDocId(threadId);
  const path = `threads/${safeThreadId}/messages`;
  const msgsQuery = query(
    collection(db, 'threads', safeThreadId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(
    msgsQuery,
    (snap) => {
      onMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function sendThreadMessageToFirestore(input: {
  threadId: string;
  msgId: string;
  senderRole: 'customer' | 'captain' | 'merchant';
  senderName: string;
  text: string;
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !input.threadId || !input.text.trim()) return false;
  const safeThreadId = sanitizeDocId(input.threadId);
  const safeMsgId = sanitizeDocId(input.msgId);
  const path = `threads/${safeThreadId}/messages/${safeMsgId}`;
  try {
    await setDoc(doc(db, 'threads', safeThreadId, 'messages', safeMsgId), {
      id: safeMsgId,
      senderUid: user.uid,
      senderRole: input.senderRole,
      senderName: clampStr(input.senderName || 'مستخدم مشوار', BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      text: clampStr(input.text, BLUEPRINT_LIMITS.CHAT_TEXT_MAX),
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncCommuteSlotToFirestore(
  subId: string,
  slot: {
    id: string;
    slotType: 'morning_go' | 'evening_return';
    dateIso: string;
    scheduledTime: string;
    status: 'scheduled' | 'driver_assigned' | 'en_route' | 'completed' | 'skipped';
    captainName?: string;
    ridePin?: string;
  }
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !subId || !slot.id) return false;
  const safeSubId = sanitizeDocId(subId);
  const safeSlotId = sanitizeDocId(slot.id);
  const path = `commuteSubscriptions/${safeSubId}/slots/${safeSlotId}`;
  try {
    const subSnap = await getDoc(doc(db, 'commuteSubscriptions', safeSubId));
    if (!subSnap.exists()) return false;
    const slotRef = doc(db, 'commuteSubscriptions', safeSubId, 'slots', safeSlotId);
    const slotSnap = await getDoc(slotRef);
    if (slotSnap.exists()) {
      const updatePayload: Record<string, unknown> = {
        status: slot.status,
        updatedAt: serverTimestamp(),
      };
      if (slot.captainName !== undefined) {
        updatePayload.captainName = clampStr(slot.captainName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);
      }
      if (slot.ridePin !== undefined) {
        updatePayload.ridePin = clampStr(slot.ridePin, BLUEPRINT_LIMITS.RIDE_PIN_MAX);
      }
      await updateDoc(slotRef, updatePayload);
      return true;
    }

    const createPayload: Record<string, unknown> = {
      id: safeSlotId,
      subscriptionId: safeSubId,
      passengerId: user.uid,
      slotType: slot.slotType,
      dateIso: clampStr(slot.dateIso, 20),
      scheduledTime: clampStr(slot.scheduledTime, 12),
      status: slot.status,
      updatedAt: serverTimestamp(),
    };
    if (slot.captainName) {
      createPayload.captainName = clampStr(slot.captainName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);
    }
    if (slot.ridePin) {
      createPayload.ridePin = clampStr(slot.ridePin, BLUEPRINT_LIMITS.RIDE_PIN_MAX);
    }
    await setDoc(slotRef, createPayload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToCommuteSlotsInFirestore(
  subId: string,
  onSlots: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const user = auth.currentUser;
  if (!user || !subId) return () => {};
  const safeSubId = sanitizeDocId(subId);
  const path = `commuteSubscriptions/${safeSubId}/slots`;
  return onSnapshot(
    collection(db, 'commuteSubscriptions', safeSubId, 'slots'),
    (snap) => {
      onSlots(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export interface CaptainNotificationFirestoreInput {
  notifId: string;
  orderId: string;
  orderNumber: string;
  zoneArea: string;
  titleAr: string;
  bodyAr: string;
  serviceType: 'restaurant_store' | 'package' | 'errand' | 'ride' | 'prescription_list';
  estimatedEarningsPiasters: number;
  soundProfile?: 'radar_pulse' | 'bagour_chime' | 'urgent_dispatch' | 'soft_bell';
}

export async function createCaptainNotificationInFirestore(
  input: CaptainNotificationFirestoreInput
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const safeId = sanitizeDocId(input.notifId);
  const safeOrderId = sanitizeDocId(input.orderId);
  const path = `captainNotifications/${safeId}`;

  try {
    await setDoc(doc(db, 'captainNotifications', safeId), {
      id: safeId,
      orderId: safeOrderId,
      orderNumber: clampStr(input.orderNumber || 'MSH-NEW', BLUEPRINT_LIMITS.NOTIF_ORDER_NUM_MAX),
      recipientScope: 'el_bagour_captains',
      senderUid: user.uid,
      cityId: 'el_bagour',
      zoneArea: clampStr(input.zoneArea || 'مركز الباجور', BLUEPRINT_LIMITS.NOTIF_ZONE_MAX),
      titleAr: clampStr(input.titleAr || 'طلب جديد في الباجور', BLUEPRINT_LIMITS.NOTIF_TITLE_MAX),
      bodyAr: clampStr(input.bodyAr || 'طلب توصيل جديد جاهز للاستلام', BLUEPRINT_LIMITS.NOTIF_BODY_MAX),
      serviceType: input.serviceType,
      estimatedEarningsPiasters: Math.max(
        0,
        Math.min(500000, Math.round(input.estimatedEarningsPiasters || 0))
      ),
      soundProfile: input.soundProfile || 'radar_pulse',
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToCaptainNotificationsInFirestore(
  onNotifications: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const user = auth.currentUser;
  if (!user) return () => {};
  const notifQuery = query(
    collection(db, 'captainNotifications'),
    where('recipientScope', '==', 'el_bagour_captains'),
    limit(30)
  );
  return onSnapshot(
    notifQuery,
    (snap) => {
      const rows: Record<string, unknown>[] = snap.docs
        .map((d): Record<string, unknown> => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }))
        .sort((a, b) => {
          const aTime = (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
          const bTime = (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
      onNotifications(rows);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'captainNotifications');
    }
  );
}

export async function markCaptainNotificationReadInFirestore(notifId: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !notifId) return false;
  const safeId = sanitizeDocId(notifId);
  const path = `captainNotifications/${safeId}`;
  try {
    const ref = doc(db, 'captainNotifications', safeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    await updateDoc(ref, {
      isRead: true,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export { firebaseSignOut, onAuthStateChanged, type ConfirmationResult, type RecaptchaVerifier, type User };
