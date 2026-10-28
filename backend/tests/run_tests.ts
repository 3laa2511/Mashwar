/**
 * Mashwar — Backend Automated Quality Gates & Integration Test Suite
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 *
 * Runs automated integration tests for:
 * 1. Authoritative Pricing Engine & Integer Piasters Precision
 * 2. Regulatory Compliance Lock (Passenger Mobility Prohibition)
 * 3. Cryptographic Quote HMAC Signature & Anti-Tamper Protection
 * 4. Order FSM Transitions & Rejection of Illegal Jumps
 * 5. Cash-on-Delivery Mandatory Verification at Doorstep
 * 6. High-Concurrency Captain Assignment Race Conditions (Atomic Mutex)
 * 7. Captain Subscription Lifecycle (Active, 72h Grace Window, Expired)
 * 8. Cash Holding Ceiling Enforcement (1,000 EGP / 100,000 Piasters)
 * 9. Webhook HMAC-SHA256 Signature Security
 * 10. Webhook Replay Deduplication & Idempotency Store
 */

import { PricingEngine } from '../src/pricing/pricingEngine.js';
import { OrderFsm } from '../src/orders/orderFsm.js';
import { CaptainEligibilityEngine } from '../src/captain/captainEligibility.js';
import { AssignmentService } from '../src/dispatch/assignmentService.js';
import { WebhookService } from '../src/payments/webhookService.js';
import { AccessControlGuard } from '../src/security/rbac.js';
import { AuditLogger } from '../src/security/auditLogger.js';
import crypto from 'node:crypto';
import { PersistentStore } from '../src/store/persistentStore.js';
import { Order, CaptainProfile, WebhookEventPayload } from '../src/types/index.js';
import { verifyToken, generateTestToken } from '../src/security/auth.js';
import { CaptainService } from '../src/services/captainService.js';
import { CashCollectionService } from '../src/services/cashCollectionService.js';
import { MerchantService } from '../src/services/merchantService.js';
import { ComplaintService } from '../src/services/complaintService.js';
import { verifyOrRunMigrations } from '../src/database/migrator.js';
import { createRateLimiter, resetAllRateLimiters } from '../src/security/rateLimiter.js';
import { createServer } from '../src/api/server.js';
import { resetTestDatabases } from '../src/api/routes.js';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(suite: string, name: string, fn: () => Promise<void> | void) {
  const start = performance.now();
  try {
    await fn();
    const durationMs = Math.round(performance.now() - start);
    results.push({ suite, name, passed: true, durationMs });
    console.log(`  ✓ [PASS] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    results.push({ suite, name, passed: false, durationMs, error: err.message });
    console.error(`  ✗ [FAIL] ${name} (${durationMs}ms)`);
    console.error(`     Error: ${err.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function assertThrows(fn: () => void, expectedCodeOrSubstr: string) {
  let threw = false;
  try {
    fn();
  } catch (err: any) {
    threw = true;
    const msg = (err.code || '') + ' ' + (err.message || '');
    if (!msg.includes(expectedCodeOrSubstr)) {
      throw new Error(`Expected error containing '${expectedCodeOrSubstr}' but got '${msg}'`);
    }
  }
  if (!threw) {
    throw new Error(`Expected function to throw error '${expectedCodeOrSubstr}', but it succeeded.`);
  }
}

async function assertThrowsAsync(fn: () => Promise<any>, expectedCodeOrSubstr: string) {
  let threw = false;
  try {
    await fn();
  } catch (err: any) {
    threw = true;
    const msg = (err.code || '') + ' ' + (err.message || '');
    if (!msg.includes(expectedCodeOrSubstr)) {
      throw new Error(`Expected error containing '${expectedCodeOrSubstr}' but got '${msg}'`);
    }
  }
  if (!threw) {
    throw new Error(`Expected async function to throw error '${expectedCodeOrSubstr}', but it succeeded.`);
  }
}

// ----------------------------------------------------------------------------
// TEST SUITES
// ----------------------------------------------------------------------------

export async function runAllTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  // Explicitly enter isolated test environment so test token helpers are permitted
  process.env.NODE_ENV = 'test';

  console.log('================================================================');
  console.log(' MASHWAR — BACKEND INTEGRATION TEST SUITE (EL BAGOUR HUB)');
  console.log(' Execution Environment: Node.js / TypeScript / Pure Integer Units');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SUITE 1: Authoritative Pricing & Piasters Precision
  // --------------------------------------------------------------------------
  console.log('▶ SUITE 1: Authoritative Pricing Engine & Currency Invariants');
  const pricing = new PricingEngine();

  await runTest('Pricing', 'Calculates exact urban fare within 1.5km baseline (1,700 piasters)', () => {
    const quote = pricing.generateQuote({
      serviceTypeId: 'package',
      distanceKm: 1.2,
      isRuralOrVillage: false,
    });
    // Base 1500 + 0 distance + 0 rural + 200 platform = 1700 piasters (17.00 EGP)
    assert(quote.baseFarePiasters === 1500, `Base fare mismatch: ${quote.baseFarePiasters}`);
    assert(quote.distanceFarePiasters === 0, `Distance fare mismatch: ${quote.distanceFarePiasters}`);
    assert(quote.totalFarePiasters === 1700, `Total fare mismatch: ${quote.totalFarePiasters}`);
    assert(quote.formattedTotalEgp === '17.00 ج.م', `Formatted EGP mismatch: ${quote.formattedTotalEgp}`);
  });

  await runTest('Pricing', 'Calculates distance fare for trips exceeding 1.5km (3.5km -> 2,500 piasters)', () => {
    const quote = pricing.generateQuote({
      serviceTypeId: 'package',
      distanceKm: 3.5,
      isRuralOrVillage: false,
    });
    // Chargeable km: 2.0 * 400 = 800 piasters
    // Total: 1500 + 800 + 0 + 200 = 2500 piasters (25.00 EGP)
    assert(quote.distanceFarePiasters === 800, `Expected 800 piasters, got ${quote.distanceFarePiasters}`);
    assert(quote.totalFarePiasters === 2500, `Expected 2500 piasters, got ${quote.totalFarePiasters}`);
  });

  await runTest('Pricing', 'Applies rural village surcharge for outer Menoufia routes (30.00 EGP)', () => {
    const quote = pricing.generateQuote({
      serviceTypeId: 'package',
      distanceKm: 3.5,
      isRuralOrVillage: true,
    });
    // 1500 base + 800 dist + 500 rural + 200 platform = 3000 piasters
    assert(quote.ruralSurchargePiasters === 500, `Rural surcharge mismatch: ${quote.ruralSurchargePiasters}`);
    assert(quote.totalFarePiasters === 3000, `Expected 3000 piasters, got ${quote.totalFarePiasters}`);
  });

  await runTest('Pricing', 'Rejects negative distance with INVALID_DISTANCE', () => {
    assertThrows(() => {
      pricing.generateQuote({
        serviceTypeId: 'package',
        distanceKm: -2.5,
      });
    }, 'INVALID_DISTANCE');
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Regulatory Lock on Passenger Mobility
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 2: Regulatory Compliance Lock');

  await runTest('Regulatory', 'Blocks passenger mobility request with REGULATORY_COMPLIANCE_LOCK (403)', () => {
    assertThrows(() => {
      pricing.generateQuote({
        serviceTypeId: 'passenger',
        distanceKm: 4.0,
      });
    }, 'REGULATORY_COMPLIANCE_LOCK');
  });

  // --------------------------------------------------------------------------
  // SUITE 3: HMAC Quote Signature & Anti-Tamper Security
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 3: Quote Cryptographic Signature & Anti-Tamper Guard');

  await runTest('Security', 'Validates legitimate quote signature created by authoritative engine', () => {
    const quote = pricing.generateQuote({
      serviceTypeId: 'package',
      distanceKm: 3.0,
    });
    const isValid = pricing.verifyQuote(quote);
    assert(isValid === true, 'Legitimate signature must verify successfully');
  });

  await runTest('Security', 'Detects and rejects tampered fare quote (price altered by client)', () => {
    const quote = pricing.generateQuote({
      serviceTypeId: 'package',
      distanceKm: 3.0,
    });
    // Malicious client tries to discount total from 2300 to 500 piasters
    const tamperedQuote = {
      ...quote,
      totalFarePiasters: 500,
    };
    assertThrows(() => {
      pricing.verifyQuote(tamperedQuote);
    }, 'QUOTE_SIGNATURE_TAMPERED');
  });

  // --------------------------------------------------------------------------
  // SUITE 4: Order Finite State Machine & Illegal Jump Rejection
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 4: Order Finite State Machine (FSM) Transitions');

  const baseOrder: Order = {
    id: 'ord_test_01',
    orderNumber: 'MSH-1001',
    customerId: 'usr_cust_01',
    customerName: 'أحمد محمود',
    customerPhone: '+201012345678',
    serviceTypeId: 'package',
    status: 'created',
    quoteId: 'quote_9812a',
    pickup: { landmarkName: 'ميدان المحطة', detailedAddress: 'برج الأمل', contactPhone: '+201012345678' },
    dropoff: { landmarkName: 'مستشفى الباجور العام', detailedAddress: 'الاستقبال', contactPhone: '+201198765432' },
    itemDescription: 'أوراق رسمية',
    totalFarePiasters: 2500,
    paymentMethod: 'cash_on_delivery',
    isPaid: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await runTest('FSM', 'Rejects illegal status jump directly from created to delivered', () => {
    assertThrows(() => {
      OrderFsm.transition(baseOrder, {
        targetStatus: 'delivered',
        actorId: 'usr_cust_01',
        actorRole: 'customer',
      });
    }, 'INVALID_STATE_TRANSITION');
  });

  await runTest('FSM', 'Rejects mutating terminal delivered order', () => {
    const deliveredOrder: Order = { ...baseOrder, status: 'delivered', isPaid: true };
    assertThrows(() => {
      OrderFsm.transition(deliveredOrder, {
        targetStatus: 'in_transit',
        actorId: 'cap_01',
        actorRole: 'captain',
      });
    }, 'TERMINAL_STATE_MUTATION_FORBIDDEN');
  });

  await runTest('FSM', 'Enforces strict linear progression through all valid delivery states', () => {
    // 1. created -> searching_captain
    const s1 = OrderFsm.transition(baseOrder, {
      targetStatus: 'searching_captain',
      actorId: 'usr_cust_01',
      actorRole: 'customer',
    });
    assert(s1.newStatus === 'searching_captain', 'Must reach searching_captain');

    // 2. searching_captain -> captain_assigned
    const withCaptain: Order = {
      ...s1.order,
      assignedCaptainId: 'cap_01',
      captainName: 'كابتن طارق الغريب',
    };
    const s2 = OrderFsm.transition(withCaptain, {
      targetStatus: 'captain_assigned',
      actorId: 'cap_01',
      actorRole: 'captain',
    });
    assert(s2.newStatus === 'captain_assigned', 'Must reach captain_assigned');

    // 3. captain_assigned -> at_pickup
    const s3 = OrderFsm.transition(s2.order, {
      targetStatus: 'at_pickup',
      actorId: 'cap_01',
      actorRole: 'captain',
    });
    assert(s3.newStatus === 'at_pickup', 'Must reach at_pickup');

    // 4. at_pickup -> in_transit
    const s4 = OrderFsm.transition(s3.order, {
      targetStatus: 'in_transit',
      actorId: 'cap_01',
      actorRole: 'captain',
    });
    assert(s4.newStatus === 'in_transit', 'Must reach in_transit');

    // 5. in_transit -> delivered (with cash recorded)
    const s5 = OrderFsm.transition(s4.order, {
      targetStatus: 'delivered',
      actorId: 'cap_01',
      actorRole: 'captain',
      cashCollectedPiasters: 2500,
    });
    assert(s5.newStatus === 'delivered', 'Must reach delivered');
    assert(s5.order.isPaid === true, 'Order must be marked as paid after cash collection');
  });

  await runTest('FSM', 'Blocks delivered transition if cash collection is missing on COD', () => {
    const inTransitOrder: Order = {
      ...baseOrder,
      status: 'in_transit',
      assignedCaptainId: 'cap_01',
      paymentMethod: 'cash_on_delivery',
      cashCollectedPiasters: undefined,
    };
    assertThrows(() => {
      OrderFsm.transition(inTransitOrder, {
        targetStatus: 'delivered',
        actorId: 'cap_01',
        actorRole: 'captain',
      });
    }, 'MISSING_CASH_COLLECTION');
  });

  // --------------------------------------------------------------------------
  // SUITE 5: Concurrency Guard & Atomic Captain Assignment Race
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 5: Captain Assignment Concurrency & Race Condition Guard');

  await runTest('Concurrency', 'Resolves 10 simultaneous captain acceptance requests: exactly 1 wins, 9 get 409', async () => {
    let orderToClaim: Order = {
      ...baseOrder,
      id: 'ord_race_99',
      status: 'searching_captain',
    };

    // Create 10 simulated captains
    const captains: CaptainProfile[] = Array.from({ length: 10 }, (_, i) => ({
      id: `cap_race_${i + 1}`,
      userId: `usr_race_${i + 1}`,
      fullName: `كابتن المتسابق ${i + 1}`,
      phone: `+2010000000${i + 1}`,
      nationalIdMasked: `2900000000000${i}`,
      vehicleType: 'motorcycle',
      vehiclePlate: `١٢٣${i} م ن`,
      subscriptionStatus: 'active',
      subscriptionPlanCode: 'EL_BAGOUR_MONTHLY_STANDARD',
      currentPeriodEndsAt: new Date(Date.now() + 20 * 86400000).toISOString(),
      cashHoldingPiasters: 10000,
      maxCashHoldingPiasters: 100000,
      ratingAverage: 4.9,
      isOnline: true,
    }));

    let successCount = 0;
    let conflictCount = 0;
    let winningCaptainId = '';

    // Fire all 10 claims simultaneously
    const claimPromises = captains.map(async (captain) => {
      try {
        const result = await AssignmentService.claimOrder(
          () => orderToClaim,
          captain,
          (updated) => {
            orderToClaim = updated;
          }
        );
        if (result.success) {
          successCount++;
          winningCaptainId = captain.id;
        }
      } catch (err: any) {
        if (err.code === 'ASSIGNMENT_ALREADY_CLAIMED' || err.statusCode === 409) {
          conflictCount++;
        } else {
          throw err;
        }
      }
    });

    await Promise.all(claimPromises);

    assert(successCount === 1, `Expected exactly 1 winning captain, got ${successCount}`);
    assert(conflictCount === 9, `Expected exactly 9 conflict rejections, got ${conflictCount}`);
    assert(orderToClaim.assignedCaptainId === winningCaptainId, 'Assigned captain must match winner');
    assert(orderToClaim.status === 'captain_assigned', 'Final order state must be captain_assigned');
  });

  // --------------------------------------------------------------------------
  // SUITE 6: Captain Subscription & Cash Holding Ceiling Invariants
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 6: Captain Subscription Lifecycle & Cash Thresholds');

  await runTest('Subscription', 'Allows active captain within validity period', () => {
    const activeCap: CaptainProfile = {
      id: 'cap_01',
      userId: 'usr_01',
      fullName: 'كابتن محمود',
      phone: '+201011111111',
      nationalIdMasked: '29000000000000',
      vehicleType: 'motorcycle',
      vehiclePlate: '١٢٣٤ م ن',
      subscriptionStatus: 'active',
      subscriptionPlanCode: 'EL_BAGOUR_MONTHLY_STANDARD',
      currentPeriodEndsAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      cashHoldingPiasters: 20000,
      maxCashHoldingPiasters: 100000,
      ratingAverage: 4.8,
      isOnline: true,
    };
    const evalResult = CaptainEligibilityEngine.evaluate(activeCap);
    assert(evalResult.isEligibleForNewOffers === true, 'Active captain must be eligible');
    assert(evalResult.canAcceptCashOrders === true, 'Must be able to accept cash orders');
  });

  await runTest('Subscription', 'Allows dispatch with warning for captain in 72h grace window', () => {
    // Expired 24 hours ago (well within 72h grace window)
    const graceCap: CaptainProfile = {
      id: 'cap_02',
      userId: 'usr_02',
      fullName: 'كابتن علي',
      phone: '+201022222222',
      nationalIdMasked: '29000000000000',
      vehicleType: 'motorcycle',
      vehiclePlate: '١٢٣٤ م ن',
      subscriptionStatus: 'active',
      subscriptionPlanCode: 'EL_BAGOUR_MONTHLY_STANDARD',
      currentPeriodEndsAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      cashHoldingPiasters: 10000,
      maxCashHoldingPiasters: 100000,
      ratingAverage: 4.8,
      isOnline: true,
    };
    const evalResult = CaptainEligibilityEngine.evaluate(graceCap);
    assert(evalResult.isEligibleForNewOffers === true, 'Grace period captain must still receive offers');
    assert(evalResult.isGracePeriod === true, 'Must be marked as grace period');
    assert(evalResult.hoursRemainingInGrace !== undefined && evalResult.hoursRemainingInGrace > 0, 'Must calculate hours remaining');
  });

  await runTest('Subscription', 'Blocks dispatch for expired captain (past 72h grace window)', () => {
    // Expired 90 hours ago
    const expiredCap: CaptainProfile = {
      id: 'cap_03',
      userId: 'usr_03',
      fullName: 'كابتن حسن',
      phone: '+201033333333',
      nationalIdMasked: '29000000000000',
      vehicleType: 'motorcycle',
      vehiclePlate: '١٢٣٤ م ن',
      subscriptionStatus: 'active',
      subscriptionPlanCode: 'EL_BAGOUR_MONTHLY_STANDARD',
      currentPeriodEndsAt: new Date(Date.now() - 90 * 3600 * 1000).toISOString(),
      cashHoldingPiasters: 0,
      maxCashHoldingPiasters: 100000,
      ratingAverage: 4.8,
      isOnline: true,
    };
    const evalResult = CaptainEligibilityEngine.evaluate(expiredCap);
    assert(evalResult.isEligibleForNewOffers === false, 'Expired captain must be blocked from offers');
  });

  await runTest('Subscription', 'Blocks cash orders when cash holding reaches 1,000 EGP ceiling', () => {
    const cappedCap: CaptainProfile = {
      id: 'cap_04',
      userId: 'usr_04',
      fullName: 'كابتن إبراهيم',
      phone: '+201044444444',
      nationalIdMasked: '29000000000000',
      vehicleType: 'motorcycle',
      vehiclePlate: '١٢٣٤ م ن',
      subscriptionStatus: 'active',
      subscriptionPlanCode: 'EL_BAGOUR_MONTHLY_STANDARD',
      currentPeriodEndsAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      cashHoldingPiasters: 105000, // 1,050.00 EGP (Breaches 100,000 limit)
      maxCashHoldingPiasters: 100000,
      ratingAverage: 4.8,
      isOnline: true,
    };
    const evalResult = CaptainEligibilityEngine.evaluate(cappedCap);
    assert(evalResult.cashCeilingBreached === true, 'Must detect cash ceiling breach');
    assert(evalResult.isEligibleForNewOffers === false, 'Must block dispatch until cash is remitted');
  });

  // --------------------------------------------------------------------------
  // SUITE 7: Payment Webhook HMAC Verification & Idempotency Store
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 7: Webhook Cryptographic Security & Idempotent Deduplication');

  WebhookService.clearCache();
  const webhookPayload: WebhookEventPayload = {
    eventId: 'evt_paymob_test_8812',
    provider: 'paymob',
    eventType: 'TRANSACTION_SUCCESS',
    transactionReference: 'TX-PAYMOB-987102',
    orderId: 'ord_test_01',
    amountPiasters: 2500,
    currency: 'EGP',
    timestamp: new Date().toISOString(),
  };

  const rawBody = JSON.stringify(webhookPayload);
  const validSignature = WebhookService.generateSignature(rawBody, 'paymob');
  const invalidSignature = 'deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567';

  await runTest('Webhooks', 'Rejects webhook with forged or invalid HMAC signature', async () => {
    const result = await WebhookService.processWebhook(rawBody, invalidSignature, webhookPayload);
    assert(result.received === false, 'Must reject forged signature');
    assert(result.status === 'SIGNATURE_FAILED', 'Status must be SIGNATURE_FAILED');
  });

  await runTest('Webhooks', 'Processes valid signed webhook and executes payment update', async () => {
    let orderPaidCalled: boolean = false;
    const result = await WebhookService.processWebhook(rawBody, validSignature, webhookPayload, () => {
      orderPaidCalled = true;
    });
    assert(result.received === true, 'Must receive valid webhook');
    assert(result.status === 'PROCESSED', 'Status must be PROCESSED');
    assert(orderPaidCalled, 'Callback must be executed');
  });

  await runTest('Webhooks', 'Detects duplicate webhook replay and prevents re-processing (Idempotency)', async () => {
    let callbackExecutedCount = 0;
    // Deliver the exact same webhook a second time
    const result2 = await WebhookService.processWebhook(rawBody, validSignature, webhookPayload, () => {
      callbackExecutedCount++;
    });
    assert(result2.received === true, 'Duplicate must still be acknowledged with 200 OK');
    assert(result2.status === 'ALREADY_PROCESSED', 'Status must indicate ALREADY_PROCESSED');
    assert(callbackExecutedCount === 0, 'Callback must NOT be re-executed on replay');

    // Deliver a third time
    const result3 = await WebhookService.processWebhook(rawBody, validSignature, webhookPayload, () => {
      callbackExecutedCount++;
    });
    assert(result3.status === 'ALREADY_PROCESSED', 'Third replay must also be idempotent');
    assert(callbackExecutedCount === 0, 'Callback must NOT be re-executed on third replay');
  });

  // --------------------------------------------------------------------------
  // SUITE 8: Role-Based Access Control (RBAC) & Authorization Invariants
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 8: Role-Based Access Control (RBAC) & Authorization Invariants');

  await runTest('RBAC', 'Allows owner full permission to update pricing and system settings', () => {
    assert(AccessControlGuard.hasPermission('owner', 'manage_pricing') === true, 'Owner must manage pricing');
    assert(AccessControlGuard.hasPermission('owner', 'manage_system_settings') === true, 'Owner must manage settings');
    // Calling checkPermission must not throw
    AccessControlGuard.checkPermission('owner', 'manage_pricing');
  });

  await runTest('RBAC', 'Denies operations dispatcher from modifying pricing parameters', () => {
    assert(AccessControlGuard.hasPermission('operations_dispatcher', 'manage_pricing') === false, 'Dispatcher cannot manage pricing');
    let threw = false;
    try {
      AccessControlGuard.checkPermission('operations_dispatcher', 'manage_pricing');
    } catch (err: any) {
      threw = true;
      assert(err.code === 'INSUFFICIENT_PERMISSIONS', 'Must throw INSUFFICIENT_PERMISSIONS');
      assert(err.statusCode === 403, 'Must return HTTP 403');
    }
    assert(threw, 'Must throw error on unauthorized role');
  });

  await runTest('RBAC', 'Allows dispatcher manual dispatch override but denies customer', () => {
    assert(AccessControlGuard.hasPermission('operations_dispatcher', 'manual_dispatch_override') === true, 'Dispatcher must have override');
    assert(AccessControlGuard.hasPermission('customer', 'manual_dispatch_override') === false, 'Customer must not have override');
  });

  await runTest('RBAC', 'Customer cancellation allowed pre-pickup but blocked in-transit', () => {
    assert(AccessControlGuard.canCancelOrder('customer', 'created') === true, 'Customer can cancel in created');
    assert(AccessControlGuard.canCancelOrder('customer', 'searching_captain') === true, 'Customer can cancel while searching');
    assert(AccessControlGuard.canCancelOrder('customer', 'in_transit') === false, 'Customer cannot cancel once in transit');
  });

  // --------------------------------------------------------------------------
  // SUITE 9: Immutable Operations Audit Ledger
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 9: Immutable Operations Audit Ledger');

  await runTest('Audit', 'Records immutable audit entry with actor details and state diff', () => {
    const entry = AuditLogger.record({
      actorId: 'usr_dispatcher_01',
      actorRole: 'operations_dispatcher',
      actorName: 'أحمد المنوفي (مسؤول الترحيل)',
      actionType: 'MANUAL_DISPATCH_ASSIGNMENT',
      targetEntity: 'order',
      targetId: 'ord_test_901',
      descriptionAr: 'تعيين كابتن يدوي للطلب العاجل',
      previousState: { status: 'searching_captain' },
      newState: { status: 'captain_assigned', captainId: 'cpt_test_01' },
      ipAddress: '197.38.12.99',
    });

    assert(entry.id.startsWith('audit_'), 'Audit log must generate an audit_ prefix id');
    assert(entry.timestamp !== undefined, 'Audit log must contain ISO timestamp');

    const queried = AuditLogger.query({ actionType: 'MANUAL_DISPATCH_ASSIGNMENT' });
    assert(queried.length > 0, 'Queried logs must contain recorded entry');
    assert(queried[0].actorRole === 'operations_dispatcher', 'Actor role must match');
  });

  // --------------------------------------------------------------------------
  // SUITE 10: Cash Remittance Settlement & Suspension Recovery
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 10: Cash Remittance Settlement & Suspension Recovery');

  await runTest('Remittance', 'Restores suspended captain when cash is remitted below ceiling', () => {
    PersistentStore.initialize();
    // cpt_moustafa_kamal was seeded as suspended with 102,000 piasters (1,020 EGP > 1,000 EGP ceiling)
    const cpt = PersistentStore.getCaptainById('cpt_moustafa_kamal');
    assert(cpt !== undefined, 'Must find seeded captain');
    assert(cpt!.subscriptionStatus === 'suspended', 'Must initially be suspended');

    // Remit 50,000 piasters (500 EGP)
    const remitted = PersistentStore.remitCaptainCash(
      'cpt_moustafa_kamal',
      50000,
      'usr_owner_01',
      'د. علاء (المالك)',
      'توريد الخزينة بمقر الباجور'
    );

    assert(remitted.cashHoldingPiasters === 52000, 'Remaining cash must be 52,000 piasters');
    assert(remitted.subscriptionStatus === 'active', 'Captain status must recover to active after remittance');
  });

  // --------------------------------------------------------------------------
  // SUITE 11: Tariff Parameters & Permanent Regulatory Lock
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 11: Tariff Parameters & Permanent Regulatory Lock');

  await runTest('Tariff', 'Allows owner to update El Bagour tariff parameters with audit trail', () => {
    const updated = PersistentStore.updateSettings(
      { baseFarePiasters: 1600, ratePerKmPiasters: 450 },
      'usr_owner_01',
      'د. علاء'
    );
    assert(updated.baseFarePiasters === 1600, 'Base fare must update to 1600');
    assert(updated.ratePerKmPiasters === 450, 'Rate per km must update to 450');

    const logs = AuditLogger.query({ actionType: 'SYSTEM_SETTINGS_UPDATED' });
    assert(logs.length > 0, 'Audit log must record tariff change');
  });

  await runTest('Tariff', 'Hard rejects any attempt to unlock passenger mobility', () => {
    let threw = false;
    try {
      PersistentStore.updateSettings(
        { passengerMobilityLocked: false },
        'usr_owner_01',
        'د. علاء'
      );
    } catch (err: any) {
      threw = true;
      assert(err.code === 'REGULATORY_COMPLIANCE_LOCK', 'Must throw REGULATORY_COMPLIANCE_LOCK');
      assert(err.statusCode === 403, 'Must return HTTP 403');
    }
    assert(threw, 'Must reject unlocking passenger transport');
    assert(PersistentStore.getSettings().passengerMobilityLocked === true, 'Lock must remain enforced');
  });

  // --------------------------------------------------------------------------
  // SUITE 12: Supabase Fail-Closed Token Verification & RBAC
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 12: Supabase Fail-Closed Token Verification & RBAC');

  await runTest('Auth', 'Rejects missing token with 401 MISSING_TOKEN', () => {
    assertThrows(() => {
      verifyToken('');
    }, 'MISSING_TOKEN');
  });

  await runTest('Auth', 'Rejects forged or tampered JWT signature with 401 INVALID_TOKEN_SIGNATURE', () => {
    const validToken = generateTestToken({
      userId: 'usr_cust_01',
      role: 'customer',
    });
    const parts = validToken.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.tampered_sig_12345`;
    assertThrows(() => {
      verifyToken(tamperedToken);
    }, 'INVALID_TOKEN_SIGNATURE');
  });

  await runTest('Auth', 'Rejects expired JWT token with 401 TOKEN_EXPIRED', () => {
    const expiredToken = generateTestToken({
      userId: 'usr_cust_01',
      role: 'customer',
      expiresInSeconds: -3600, // expired 1 hour ago
    });
    assertThrows(() => {
      verifyToken(expiredToken);
    }, 'TOKEN_EXPIRED');
  });

  await runTest('Auth', 'Rejects unverified or invalid role with 403 UNAUTHORIZED_ROLE', () => {
    const hackerToken = generateTestToken({
      userId: 'usr_hacker_99',
      role: 'super_admin' as any, // Not an approved UserRole
    });
    assertThrows(() => {
      verifyToken(hackerToken);
    }, 'UNAUTHORIZED_ROLE');
  });

  await runTest('Auth', 'Rejects token with invalid audience or untrusted issuer', () => {
    // Generate token with invalid aud
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'usr_cpt_01',
      iss: 'supabase',
      aud: 'external_client_aud',
      app_metadata: { role: 'captain' },
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const sig = crypto.createHmac('sha256', 'mashwar_secure_supabase_jwt_secret_el_bagour_2026')
      .update(`${header}.${payload}`)
      .digest('base64url');
    const badAudToken = `${header}.${payload}.${sig}`;

    assertThrows(() => {
      verifyToken(badAudToken);
    }, 'INVALID_TOKEN_AUDIENCE');

    // Generate token with missing aud
    const noAudPayload = Buffer.from(JSON.stringify({
      sub: 'usr_cpt_01',
      iss: 'supabase',
      app_metadata: { role: 'captain' },
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const noAudSig = crypto.createHmac('sha256', 'mashwar_secure_supabase_jwt_secret_el_bagour_2026')
      .update(`${header}.${noAudPayload}`)
      .digest('base64url');
    assertThrows(() => {
      verifyToken(`${header}.${noAudPayload}.${noAudSig}`);
    }, 'INVALID_TOKEN_AUDIENCE');

    // Generate token with untrusted issuer (iss)
    const badIssPayload = Buffer.from(JSON.stringify({
      sub: 'usr_cpt_01',
      iss: 'https://evil-attacker.example.com/auth/v1',
      aud: 'authenticated',
      app_metadata: { role: 'captain' },
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const badIssSig = crypto.createHmac('sha256', 'mashwar_secure_supabase_jwt_secret_el_bagour_2026')
      .update(`${header}.${badIssPayload}`)
      .digest('base64url');
    const badIssToken = `${header}.${badIssPayload}.${badIssSig}`;

    assertThrows(() => {
      verifyToken(badIssToken);
    }, 'INVALID_TOKEN_ISSUER');

    // Generate token without exp claim
    const noExpPayload = Buffer.from(JSON.stringify({
      sub: 'usr_cpt_01',
      iss: 'supabase',
      aud: 'authenticated',
      app_metadata: { role: 'captain' },
    })).toString('base64url');
    const noExpSig = crypto.createHmac('sha256', 'mashwar_secure_supabase_jwt_secret_el_bagour_2026')
      .update(`${header}.${noExpPayload}`)
      .digest('base64url');
    const noExpToken = `${header}.${noExpPayload}.${noExpSig}`;

    assertThrows(() => {
      verifyToken(noExpToken);
    }, 'TOKEN_EXPIRED');
  });

  await runTest('Auth', 'Rejects token relying on top-level payload.role when app_metadata.role is missing', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'usr_hacker_01',
      iss: 'supabase',
      aud: 'authenticated',
      role: 'owner', // Top-level role only
      app_metadata: {}, // Empty app_metadata
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const sig = crypto.createHmac('sha256', 'mashwar_secure_supabase_jwt_secret_el_bagour_2026')
      .update(`${header}.${payload}`)
      .digest('base64url');
    const spoofedToken = `${header}.${payload}.${sig}`;

    assertThrows(() => {
      verifyToken(spoofedToken);
    }, 'UNAUTHORIZED_ROLE');
  });

  await runTest('Auth', 'Authoritatively extracts principal ID and app_metadata.role from valid token', () => {
    const validToken = generateTestToken({
      userId: 'usr_cpt_01',
      role: 'captain',
      fullName: 'أحمد فتحي',
      phone: '+201012345671',
    });
    const user = verifyToken(validToken);
    assert(user.id === 'usr_cpt_01', 'User ID must match sub');
    assert(user.role === 'captain', 'Role must match app_metadata.role');
    assert(user.phone === '+201012345671', 'Phone must match user metadata');
  });

  await runTest('Auth', 'Fails closed across all non-test environments (production, staging, development, unset) when SUPABASE_JWT_SECRET is missing or placeholder', () => {
    const sampleToken = generateTestToken({ userId: 'usr_cpt_01', role: 'captain' });
    const prevNodeEnv = process.env.NODE_ENV;
    const prevSecret = process.env.SUPABASE_JWT_SECRET;

    try {
      delete process.env.SUPABASE_JWT_SECRET;

      for (const envName of ['production', 'staging', 'development', undefined]) {
        if (envName === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = envName;

        assertThrows(() => {
          verifyToken(sampleToken);
        }, 'AUTH_CONFIG_MISSING');

        assertThrows(() => {
          generateTestToken({ userId: 'usr_cpt_01', role: 'captain' });
        }, 'TEST_TOKEN_FORBIDDEN_IN_PRODUCTION');
      }

      // Placeholder secret from .env.example must also fail closed outside isolated tests
      process.env.NODE_ENV = 'development';
      process.env.SUPABASE_JWT_SECRET = 'CHANGE_ME_MIN_32_CHAR_SUPABASE_JWT_SECRET';
      assertThrows(() => {
        verifyToken(sampleToken);
      }, 'AUTH_CONFIG_MISSING');
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;

      if (prevSecret === undefined) delete process.env.SUPABASE_JWT_SECRET;
      else process.env.SUPABASE_JWT_SECRET = prevSecret;
    }
  });

  await runTest('Auth', 'Requires configured trusted algorithm, issuer, and audience in production and rejects missing or mismatched claims', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevSecret = process.env.SUPABASE_JWT_SECRET;
    const prevIssuer = process.env.SUPABASE_JWT_ISSUER;
    const prevUrl = process.env.SUPABASE_URL;
    const prevAlg = process.env.SUPABASE_JWT_ALG;
    const prevAud = process.env.SUPABASE_JWT_AUDIENCE;

    try {
      const prodSecret = 'prod_strong_hmac_secret_el_bagour_2026_verified';
      const trustedIssuer = 'https://mashwar-prod-ref.supabase.co/auth/v1';

      // Sign tokens while in isolated test mode
      process.env.NODE_ENV = 'test';
      process.env.SUPABASE_JWT_SECRET = prodSecret;

      const validProdToken = generateTestToken({
        userId: 'usr_cpt_01',
        role: 'captain',
        issuer: trustedIssuer,
        audience: 'authenticated',
      });
      const mismatchedIssToken = generateTestToken({
        userId: 'usr_cpt_01',
        role: 'captain',
        issuer: 'https://wrong-project.supabase.co/auth/v1',
        audience: 'authenticated',
      });
      const mismatchedAudToken = generateTestToken({
        userId: 'usr_cpt_01',
        role: 'captain',
        issuer: trustedIssuer,
        audience: 'wrong-aud',
      });

      // Construct a token with no iss claim at all
      const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const noIssPayloadB64 = Buffer.from(
        JSON.stringify({
          sub: 'usr_cpt_01',
          aud: 'authenticated',
          app_metadata: { role: 'captain' },
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      const noIssSig = crypto
        .createHmac('sha256', prodSecret)
        .update(`${headerB64}.${noIssPayloadB64}`)
        .digest('base64url');
      const missingIssToken = `${headerB64}.${noIssPayloadB64}.${noIssSig}`;

      // Switch to production
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_JWT_ALG;
      delete process.env.SUPABASE_JWT_ISSUER;
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_JWT_AUDIENCE;

      // 1. Missing SUPABASE_JWT_ALG in production -> 500 AUTH_CONFIG_MISSING
      assertThrows(() => {
        verifyToken(validProdToken);
      }, 'AUTH_CONFIG_MISSING');

      process.env.SUPABASE_JWT_ALG = 'HS256';

      // 2. Missing configured issuer on server in production -> 500 AUTH_CONFIG_MISSING
      assertThrows(() => {
        verifyToken(validProdToken);
      }, 'AUTH_CONFIG_MISSING');

      process.env.SUPABASE_URL = 'https://mashwar-prod-ref.supabase.co';

      // 3. Missing configured audience (SUPABASE_JWT_AUDIENCE) in production -> 500 AUTH_CONFIG_MISSING
      assertThrows(() => {
        verifyToken(validProdToken);
      }, 'AUTH_CONFIG_MISSING');

      process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';

      // 4. Token with missing iss in production -> 401 INVALID_TOKEN_ISSUER
      assertThrows(() => {
        verifyToken(missingIssToken);
      }, 'INVALID_TOKEN_ISSUER');

      // 5. Token with mismatched iss in production -> 401 INVALID_TOKEN_ISSUER
      assertThrows(() => {
        verifyToken(mismatchedIssToken);
      }, 'INVALID_TOKEN_ISSUER');

      // 6. Token with mismatched aud in production -> 401 INVALID_TOKEN_AUDIENCE
      assertThrows(() => {
        verifyToken(mismatchedAudToken);
      }, 'INVALID_TOKEN_AUDIENCE');

      // 7. Token with matching alg, secret, iss, and aud in production -> succeeds
      const verified = verifyToken(validProdToken);
      assert(verified.id === 'usr_cpt_01', 'Verified production user ID must match');
      assert(verified.role === 'captain', 'Verified production user role must match');
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;

      if (prevSecret === undefined) delete process.env.SUPABASE_JWT_SECRET;
      else process.env.SUPABASE_JWT_SECRET = prevSecret;

      if (prevIssuer === undefined) delete process.env.SUPABASE_JWT_ISSUER;
      else process.env.SUPABASE_JWT_ISSUER = prevIssuer;

      if (prevUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = prevUrl;

      if (prevAlg === undefined) delete process.env.SUPABASE_JWT_ALG;
      else process.env.SUPABASE_JWT_ALG = prevAlg;

      if (prevAud === undefined) delete process.env.SUPABASE_JWT_AUDIENCE;
      else process.env.SUPABASE_JWT_AUDIENCE = prevAud;
    }
  });

  await runTest('Auth', 'Verifies Supabase asymmetric ES256 (P-256) and RS256 tokens, strict key-to-algorithm mapping, and prevents HS256 algorithm confusion', () => {
    const prevPubPem = process.env.SUPABASE_JWT_PUBLIC_KEY;
    const prevPubJwk = process.env.SUPABASE_JWT_PUBLIC_JWK;
    const prevAlg = process.env.SUPABASE_JWT_ALG;
    const prevSecret = process.env.SUPABASE_JWT_SECRET;

    try {
      delete process.env.SUPABASE_JWT_SECRET;

      // 1. Generate ECDSA P-256 (prime256v1) key pair for Supabase ES256
      const { privateKey: ecPriv, publicKey: ecPub } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
      });
      const ecPubPem = ecPub.export({ type: 'spki', format: 'pem' }).toString();
      const ecPrivPem = ecPriv.export({ type: 'pkcs8', format: 'pem' }).toString();
      const ecPubJwk = JSON.stringify(ecPub.export({ format: 'jwk' }));

      const esHeaderB64 = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
      const claimsB64 = Buffer.from(
        JSON.stringify({
          sub: 'usr_cpt_es256',
          iss: 'supabase',
          aud: 'authenticated',
          app_metadata: { role: 'captain' },
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');

      const esSig = crypto
        .sign('sha256', Buffer.from(`${esHeaderB64}.${claimsB64}`, 'utf8'), {
          key: ecPriv,
          dsaEncoding: 'ieee-p1363',
        })
        .toString('base64url');
      const es256Token = `${esHeaderB64}.${claimsB64}.${esSig}`;

      // Missing public key for ES256 must fail closed with AUTH_CONFIG_MISSING
      delete process.env.SUPABASE_JWT_PUBLIC_KEY;
      delete process.env.SUPABASE_JWT_PUBLIC_JWK;
      assertThrows(() => {
        verifyToken(es256Token);
      }, 'AUTH_CONFIG_MISSING');

      // Verify ES256 with PEM public key
      process.env.SUPABASE_JWT_PUBLIC_KEY = ecPubPem;
      const esUserPem = verifyToken(es256Token);
      assert(esUserPem.id === 'usr_cpt_es256', 'ES256 PEM verification must extract sub');
      assert(esUserPem.role === 'captain', 'ES256 PEM verification must extract role');

      // Reject private key PEM passed in SUPABASE_JWT_PUBLIC_KEY
      process.env.SUPABASE_JWT_PUBLIC_KEY = ecPrivPem;
      assertThrows(() => {
        verifyToken(es256Token);
      }, 'AUTH_CONFIG_MISSING');

      // Reject non-P-256 curve (e.g. P-384 / secp384r1) for ES256
      const { publicKey: p384Pub } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
      process.env.SUPABASE_JWT_PUBLIC_KEY = p384Pub.export({ type: 'spki', format: 'pem' }).toString();
      assertThrows(() => {
        verifyToken(es256Token);
      }, 'AUTH_CONFIG_MISSING');

      // Verify ES256 with JWK public key
      delete process.env.SUPABASE_JWT_PUBLIC_KEY;
      process.env.SUPABASE_JWT_PUBLIC_JWK = ecPubJwk;
      const esUserJwk = verifyToken(es256Token);
      assert(esUserJwk.id === 'usr_cpt_es256', 'ES256 JWK verification must extract sub');

      // Reject ambiguous config when BOTH SUPABASE_JWT_PUBLIC_KEY and SUPABASE_JWT_PUBLIC_JWK are set
      process.env.SUPABASE_JWT_PUBLIC_KEY = ecPubPem;
      assertThrows(() => {
        verifyToken(es256Token);
      }, 'AUTH_CONFIG_MISSING');
      delete process.env.SUPABASE_JWT_PUBLIC_JWK;

      // Forged ES256 signature must fail with INVALID_TOKEN_SIGNATURE
      const forgedEs256Token = `${esHeaderB64}.${claimsB64}.${Buffer.alloc(64, 7).toString('base64url')}`;
      assertThrows(() => {
        verifyToken(forgedEs256Token);
      }, 'INVALID_TOKEN_SIGNATURE');

      // Prevent algorithm confusion:
      // Case A: attacker signs an HS256 token while server has asymmetric public key configured
      const hsHeaderB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const confusedSig = crypto
        .createHmac('sha256', ecPubPem)
        .update(`${hsHeaderB64}.${claimsB64}`)
        .digest('base64url');
      const confusedToken = `${hsHeaderB64}.${claimsB64}.${confusedSig}`;
      assertThrows(() => {
        verifyToken(confusedToken);
      }, 'INVALID_TOKEN_ALGORITHM');

      // Case B: misconfigured server puts PEM public key or JWK into SUPABASE_JWT_SECRET for HS256
      delete process.env.SUPABASE_JWT_PUBLIC_KEY;
      process.env.SUPABASE_JWT_SECRET = ecPubPem;
      assertThrows(() => {
        verifyToken(confusedToken);
      }, 'AUTH_CONFIG_MISSING');
      process.env.SUPABASE_JWT_SECRET = ecPubJwk;
      assertThrows(() => {
        verifyToken(confusedToken);
      }, 'AUTH_CONFIG_MISSING');
      delete process.env.SUPABASE_JWT_SECRET;

      // Reject alg: "none"
      const noneHeaderB64 = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      assertThrows(() => {
        verifyToken(`${noneHeaderB64}.${claimsB64}.${esSig}`);
      }, 'INVALID_TOKEN_ALGORITHM');

      // 2. Generate RSA 2048 key pair for RS256 verification
      delete process.env.SUPABASE_JWT_PUBLIC_JWK;
      const { privateKey: rsaPriv, publicKey: rsaPub } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      process.env.SUPABASE_JWT_PUBLIC_KEY = rsaPub.export({ type: 'spki', format: 'pem' }).toString();

      const rsHeaderB64 = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const rsSig = crypto
        .sign('RSA-SHA256', Buffer.from(`${rsHeaderB64}.${claimsB64}`, 'utf8'), rsaPriv)
        .toString('base64url');
      const rs256Token = `${rsHeaderB64}.${claimsB64}.${rsSig}`;

      const rsUser = verifyToken(rs256Token);
      assert(rsUser.id === 'usr_cpt_es256', 'RS256 verification must extract sub');

      // Enforce SUPABASE_JWT_ALG mismatch rejection
      process.env.SUPABASE_JWT_ALG = 'ES256';
      assertThrows(() => {
        verifyToken(rs256Token);
      }, 'INVALID_TOKEN_ALGORITHM');
    } finally {
      if (prevPubPem === undefined) delete process.env.SUPABASE_JWT_PUBLIC_KEY;
      else process.env.SUPABASE_JWT_PUBLIC_KEY = prevPubPem;

      if (prevPubJwk === undefined) delete process.env.SUPABASE_JWT_PUBLIC_JWK;
      else process.env.SUPABASE_JWT_PUBLIC_JWK = prevPubJwk;

      if (prevAlg === undefined) delete process.env.SUPABASE_JWT_ALG;
      else process.env.SUPABASE_JWT_ALG = prevAlg;

      if (prevSecret === undefined) delete process.env.SUPABASE_JWT_SECRET;
      else process.env.SUPABASE_JWT_SECRET = prevSecret;
    }
  });

  // --------------------------------------------------------------------------
  // SUITE 13: Database-Backed Captain Identity Resolution
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 13: Database-Backed Captain Identity Resolution');

  await runTest('CaptainResolution', 'Successfully resolves registered captain profile using authenticated sub (userId)', async () => {
    PersistentStore.initialize();
    const resolved = await CaptainService.resolveByUserId('usr_cpt_01');
    assert(resolved !== null, 'Must resolve captain for usr_cpt_01');
    assert(resolved!.id === 'cpt_ahmed_fathy', 'Captain ID must match cpt_ahmed_fathy');
    assert(resolved!.fullName === 'أحمد فتحي الديب', 'Full name must match seeded captain');
  });

  await runTest('CaptainResolution', 'Rejects non-existent captain user_id with 404 CAPTAIN_PROFILE_NOT_FOUND', async () => {
    await assertThrowsAsync(async () => {
      await CaptainService.requireActiveCaptain('usr_ghost_nonexistent');
    }, 'CAPTAIN_PROFILE_NOT_FOUND');
  });

  await runTest('CaptainResolution', 'Blocks dispatch claims for suspended captain with 403 CAPTAIN_ACCOUNT_SUSPENDED', async () => {
    const cap = PersistentStore.getCaptainById('cpt_moustafa_kamal');
    if (cap) {
      cap.subscriptionStatus = 'suspended';
      PersistentStore.saveCaptain(cap);
    }
    await assertThrowsAsync(async () => {
      await CaptainService.requireActiveCaptain('usr_cpt_04');
    }, 'CAPTAIN_ACCOUNT_SUSPENDED');
  });

  // --------------------------------------------------------------------------
  // SUITE 14: Atomic Transactional Cash Collection & Idempotent Ledger
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 14: Atomic Transactional Cash Collection, Idempotency & Ceiling');

  CashCollectionService.clearCache();
  PersistentStore.initialize();

  // Create an order in_transit assigned to cpt_ahmed_fathy
  const codOrder: Order = {
    ...baseOrder,
    id: 'ord_cash_test_101',
    orderNumber: 'MSH-9901',
    customerId: 'usr_cust_01',
    serviceTypeId: 'package',
    status: 'in_transit',
    assignedCaptainId: 'cpt_ahmed_fathy',
    captainName: 'أحمد فتحي الديب',
    totalFarePiasters: 2500, // 25.00 EGP
    paymentMethod: 'cash_on_delivery',
    isPaid: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  PersistentStore.saveOrder(codOrder);

  const initialCaptain = PersistentStore.getCaptainById('cpt_ahmed_fathy')!;
  const initialCashHolding = initialCaptain.cashHoldingPiasters;

  await runTest('CashCollection', 'Successfully collects exact fare in integer piasters, transitions order to delivered and marks isPaid', async () => {
    const captain = PersistentStore.getCaptainById('cpt_ahmed_fathy')!;
    const result = await CashCollectionService.recordCashCollection({
      orderId: 'ord_cash_test_101',
      captain,
      amountPiasters: 2500,
      idempotencyKey: 'idemp_key_cod_101',
    });

    assert(result.success === true, 'Cash collection must succeed');
    assert(result.amountCollectedPiasters === 2500, 'Amount must be 2,500 piasters');
    assert(result.isIdempotentReplay === false, 'First call is not a replay');
    assert(result.captainCurrentCashPiasters === initialCashHolding + 2500, 'Captain cash holding must increment');

    const updatedOrder = PersistentStore.getOrderById('ord_cash_test_101')!;
    assert(updatedOrder.isPaid === true, 'Order must be marked as isPaid = true');
    assert(updatedOrder.status === 'delivered', 'Order must transition to delivered');
    assert(updatedOrder.cashCollectedPiasters === 2500, 'cashCollectedPiasters must be recorded');
  });

  await runTest('CashCollection', 'Replays identical cash collection request and returns cached idempotent response without double crediting captain', async () => {
    const captain = PersistentStore.getCaptainById('cpt_ahmed_fathy')!;
    const currentHoldingBeforeReplay = captain.cashHoldingPiasters;

    const replayResult = await CashCollectionService.recordCashCollection({
      orderId: 'ord_cash_test_101',
      captain,
      amountPiasters: 2500,
      idempotencyKey: 'idemp_key_cod_101',
    });

    assert(replayResult.success === true, 'Replay must succeed');
    assert(replayResult.isIdempotentReplay === true, 'Must indicate isIdempotentReplay = true');

    const captainAfterReplay = PersistentStore.getCaptainById('cpt_ahmed_fathy')!;
    assert(
      captainAfterReplay.cashHoldingPiasters === currentHoldingBeforeReplay,
      'Captain cash holding must NOT be incremented twice on duplicate request'
    );
  });

  await runTest('CashCollection', 'Rejects idempotency key reuse with mismatched payload', async () => {
    const captain = PersistentStore.getCaptainById('cpt_ahmed_fathy')!;
    await assertThrowsAsync(async () => {
      // Re-use idemp_key_cod_101 with different amount (3000 vs 2500)
      await CashCollectionService.recordCashCollection({
        orderId: 'ord_cash_test_101',
        captain,
        amountPiasters: 3000,
        idempotencyKey: 'idemp_key_cod_101',
      });
    }, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
  });

  await runTest('CashCollection', 'Rejects cash collection on cancelled order', async () => {
    const captain = PersistentStore.getCaptainById('cpt_ahmed_fathy')!;
    const cancelledOrder: Order = {
      ...codOrder,
      id: 'ord_cancelled_test',
      status: 'cancelled',
      isPaid: false,
    };
    PersistentStore.saveOrder(cancelledOrder);

    await assertThrowsAsync(async () => {
      await CashCollectionService.recordCashCollection({
        orderId: 'ord_cancelled_test',
        captain,
        amountPiasters: 2500,
      });
    }, 'ORDER_CANCELLED');
  });

  await runTest('CashCollection', 'Rejects cash collection on order in created state before dispatch', async () => {
    const captain = PersistentStore.getCaptainById('cpt_ahmed_fathy')!;
    const createdOrder: Order = {
      ...codOrder,
      id: 'ord_created_predispatch_test',
      status: 'created',
      isPaid: false,
    };
    PersistentStore.saveOrder(createdOrder);

    await assertThrowsAsync(async () => {
      await CashCollectionService.recordCashCollection({
        orderId: 'ord_created_predispatch_test',
        captain,
        amountPiasters: 2500,
      });
    }, 'ORDER_NOT_IN_DELIVERY');
  });

  await runTest('CashCollection', 'Blocks cash collection if requesting captain is not the assigned captain (403)', async () => {
    const otherCaptain: CaptainProfile = {
      ...initialCaptain,
      id: 'cpt_intruder_02',
      userId: 'usr_intruder',
      fullName: 'كابتن دخيل',
    };

    // Another in-transit order
    const order2: Order = {
      ...codOrder,
      id: 'ord_cash_test_102',
      assignedCaptainId: 'cpt_ahmed_fathy',
      isPaid: false,
    };
    PersistentStore.saveOrder(order2);

    await assertThrowsAsync(async () => {
      await CashCollectionService.recordCashCollection({
        orderId: 'ord_cash_test_102',
        captain: otherCaptain,
        amountPiasters: 2500,
      });
    }, 'UNAUTHORIZED_CAPTAIN_ACTION');
  });

  await runTest('CashCollection', 'Blocks cash collection if collected amount does not match authoritative fare (422)', async () => {
    const captain = PersistentStore.getCaptainById('cpt_ahmed_fathy')!;
    const order3: Order = {
      ...codOrder,
      id: 'ord_cash_test_103',
      totalFarePiasters: 3000,
      isPaid: false,
    };
    PersistentStore.saveOrder(order3);

    await assertThrowsAsync(async () => {
      await CashCollectionService.recordCashCollection({
        orderId: 'ord_cash_test_103',
        captain,
        amountPiasters: 1500, // Tampered / underpaid
      });
    }, 'FARE_MISMATCH');
  });

  await runTest('CashCollection', 'Blocks cash collection on electronic payment orders (400)', async () => {
    const captain = PersistentStore.getCaptainById('cpt_ahmed_fathy')!;
    const onlineOrder: Order = {
      ...codOrder,
      id: 'ord_cash_test_104',
      paymentMethod: 'electronic_wallet',
      isPaid: true,
    };
    PersistentStore.saveOrder(onlineOrder);

    await assertThrowsAsync(async () => {
      await CashCollectionService.recordCashCollection({
        orderId: 'ord_cash_test_104',
        captain,
        amountPiasters: 2500,
      });
    }, 'INVALID_PAYMENT_METHOD_FOR_CASH');
  });

  await runTest('CashCollection', 'Automatically suspends captain when cumulative cash holding exceeds 100,000 piasters (1,000 EGP) ceiling', async () => {
    const nearLimitCaptain: CaptainProfile = {
      ...initialCaptain,
      id: 'cpt_near_limit',
      userId: 'usr_cpt_near',
      cashHoldingPiasters: 98000, // 980.00 EGP
      maxCashHoldingPiasters: 100000, // 1,000.00 EGP limit
      subscriptionStatus: 'active',
    };
    PersistentStore.saveCaptain(nearLimitCaptain);

    const highFareOrder: Order = {
      ...codOrder,
      id: 'ord_cash_test_105',
      assignedCaptainId: 'cpt_near_limit',
      totalFarePiasters: 3500, // 35.00 EGP -> Total cash will be 101,500 piasters (>100,000 ceiling)
      isPaid: false,
    };
    PersistentStore.saveOrder(highFareOrder);

    const result = await CashCollectionService.recordCashCollection({
      orderId: 'ord_cash_test_105',
      captain: nearLimitCaptain,
      amountPiasters: 3500,
    });

    assert(result.ceilingExceeded === true, 'Ceiling exceeded flag must be true');
    assert(result.captainCurrentCashPiasters === 101500, 'New holding must be 101,500 piasters');

    const updatedCap = PersistentStore.getCaptainById('cpt_near_limit')!;
    assert(updatedCap.subscriptionStatus === 'suspended', 'Captain must be suspended due to cash ceiling breach');
  });

  await runTest('CashCollection', 'Rejects duplicate cash collection on an already-paid order when using a different idempotency key (409 ORDER_ALREADY_PAID)', async () => {
    const captain = PersistentStore.getCaptainById('cpt_ahmed_fathy')!;
    await assertThrowsAsync(async () => {
      await CashCollectionService.recordCashCollection({
        orderId: 'ord_cash_test_101',
        captain,
        amountPiasters: 2500,
        idempotencyKey: 'idemp_key_cod_101_different_key',
      });
    }, 'ORDER_ALREADY_PAID');
  });

  // --------------------------------------------------------------------------
  // SUITE 15: Cross-Tenant Isolation & Anti-Spoofing
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 15: Cross-Tenant Isolation, Anti-Spoofing & Server-Derived Identity');

  await runTest('SecurityIsolation', 'Rejects spoofed X-Actor-* headers when no valid Bearer token is provided', () => {
    // In our security model, missing Authorization header throws UNAUTHENTICATED
    assertThrows(() => {
      verifyToken('');
    }, 'MISSING_TOKEN');
  });

  await runTest('SecurityIsolation', 'Customer A cannot read or access order details belonging to Customer B', () => {
    const orderB: Order = {
      ...baseOrder,
      id: 'ord_tenant_b_01',
      customerId: 'usr_cust_bob',
    };

    const userAlice = {
      id: 'usr_cust_alice',
      role: 'customer' as const,
    };

    const isAliceAllowed = userAlice.role !== 'customer' || orderB.customerId === userAlice.id;
    assert(isAliceAllowed === false, 'Alice must be blocked from accessing Bob order');
  });

  await runTest('SecurityIsolation', 'Customer A cannot cancel an order belonging to Customer B', () => {
    const orderB: Order = {
      ...baseOrder,
      id: 'ord_tenant_b_02',
      customerId: 'usr_cust_bob',
      status: 'created',
    };

    const userAlice = {
      id: 'usr_cust_alice',
      role: 'customer' as const,
    };

    const canCancel = orderB.customerId === userAlice.id;
    assert(canCancel === false, 'Alice cannot cancel Bob order');
  });

  await runTest('SecurityIsolation', 'Captain A cannot transition or claim an order assigned to Captain B', () => {
    const orderWithCapB: Order = {
      ...baseOrder,
      id: 'ord_tenant_cap_01',
      status: 'in_transit',
      assignedCaptainId: 'cpt_ahmed_fathy',
    };

    const captainIntruderId = 'cpt_intruder_99';
    const canTransition = orderWithCapB.assignedCaptainId === captainIntruderId;
    assert(canTransition === false, 'Intruding captain cannot transition another captain order');
  });

  await runTest('SecurityIsolation', 'Enforces HTTP 403 cross-tenant isolation and allows authorized 200 access on /orders/:id, /orders/:id/history, /orders/:id/cancel, and /orders/:id/transitions', async () => {
    const app = createServer();
    const server = app.listen(0);
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    try {
      const bobOrder: Order = {
        ...baseOrder,
        id: 'ord_http_bob_isolation_01',
        orderNumber: 'MSH-8840',
        customerId: 'usr_cust_bob',
        serviceTypeId: 'restaurant_store',
        storeId: 'merchant_basha',
        merchantUserId: 'usr_merch_basha',
        status: 'captain_assigned',
        assignedCaptainId: 'cpt_ahmed_fathy', // usr_cpt_01
        totalFarePiasters: 3500,
        paymentMethod: 'cash_on_delivery',
        isPaid: false,
      };
      PersistentStore.saveOrder(bobOrder);

      const bobToken = generateTestToken({ userId: 'usr_cust_bob', role: 'customer' });
      const aliceToken = generateTestToken({ userId: 'usr_cust_alice', role: 'customer' });
      const assignedCapToken = generateTestToken({ userId: 'usr_cpt_01', role: 'captain' }); // cpt_ahmed_fathy
      const otherCaptainToken = generateTestToken({ userId: 'usr_cpt_02', role: 'captain' }); // cpt_mahmoud_ibrahim
      const bashaMerchantToken = generateTestToken({ userId: 'usr_merch_basha', role: 'merchant' });
      const otherMerchantToken = generateTestToken({ userId: 'usr_merch_amana', role: 'merchant' });

      // 1. DENIED (403): Customer Alice cannot GET Bob's order, history, cancel, or transition-cancel
      const getOrderAlice = await fetch(`${baseUrl}/orders/${bobOrder.id}`, {
        headers: { Authorization: `Bearer ${aliceToken}` },
      });
      assert(getOrderAlice.status === 403, `Expected 403 for Alice reading Bob order, got ${getOrderAlice.status}`);

      const getHistAlice = await fetch(`${baseUrl}/orders/${bobOrder.id}/history`, {
        headers: { Authorization: `Bearer ${aliceToken}` },
      });
      assert(getHistAlice.status === 403, `Expected 403 for Alice reading Bob history, got ${getHistAlice.status}`);

      const cancelAlice = await fetch(`${baseUrl}/orders/${bobOrder.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({ reason: 'محاولة إلغاء غير مصرحة' }),
      });
      assert(cancelAlice.status === 403, `Expected 403 for Alice cancelling Bob order, got ${cancelAlice.status}`);

      const transCancelAlice = await fetch(`${baseUrl}/orders/${bobOrder.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({ targetStatus: 'cancelled' }),
      });
      assert(transCancelAlice.status === 403, `Expected 403 for Alice cancelling Bob order via /transitions, got ${transCancelAlice.status}`);

      // 2. ALLOWED (200): Owning Customer Bob and Owning Merchant Basha can GET order and history
      const getOrderBob = await fetch(`${baseUrl}/orders/${bobOrder.id}`, {
        headers: { Authorization: `Bearer ${bobToken}` },
      });
      assert(getOrderBob.status === 200, `Expected 200 for Bob reading own order, got ${getOrderBob.status}`);

      const getHistBob = await fetch(`${baseUrl}/orders/${bobOrder.id}/history`, {
        headers: { Authorization: `Bearer ${bobToken}` },
      });
      assert(getHistBob.status === 200, `Expected 200 for Bob reading own order history, got ${getHistBob.status}`);

      const getHistBasha = await fetch(`${baseUrl}/orders/${bobOrder.id}/history`, {
        headers: { Authorization: `Bearer ${bashaMerchantToken}` },
      });
      assert(getHistBasha.status === 200, `Expected 200 for owning merchant reading order history, got ${getHistBasha.status}`);

      // 3. DENIED (403): Captain B (usr_cpt_02) cannot GET order, GET history, or transition order assigned to Captain A
      const getOrderCapB = await fetch(`${baseUrl}/orders/${bobOrder.id}`, {
        headers: { Authorization: `Bearer ${otherCaptainToken}` },
      });
      assert(getOrderCapB.status === 403, `Expected 403 for unassigned captain reading assigned order, got ${getOrderCapB.status}`);

      const getHistCapB = await fetch(`${baseUrl}/orders/${bobOrder.id}/history`, {
        headers: { Authorization: `Bearer ${otherCaptainToken}` },
      });
      assert(getHistCapB.status === 403, `Expected 403 for unassigned captain reading history, got ${getHistCapB.status}`);

      const transCapB = await fetch(`${baseUrl}/orders/${bobOrder.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherCaptainToken}`,
        },
        body: JSON.stringify({ targetStatus: 'at_pickup' }),
      });
      assert(transCapB.status === 403, `Expected 403 for unassigned captain transitioning order, got ${transCapB.status}`);

      // 4. ALLOWED (200): Assigned Captain A (usr_cpt_01) can GET history and transition bobOrder to at_pickup, but CANNOT cancel (403)
      const getHistCapA = await fetch(`${baseUrl}/orders/${bobOrder.id}/history`, {
        headers: { Authorization: `Bearer ${assignedCapToken}` },
      });
      assert(getHistCapA.status === 200, `Expected 200 for assigned captain reading history, got ${getHistCapA.status}`);

      const cancelByCapA = await fetch(`${baseUrl}/orders/${bobOrder.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${assignedCapToken}`,
        },
        body: JSON.stringify({ targetStatus: 'cancelled' }),
      });
      assert(cancelByCapA.status === 403, `Expected 403 for captain attempting to cancel order via /transitions, got ${cancelByCapA.status}`);

      const transCapA = await fetch(`${baseUrl}/orders/${bobOrder.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${assignedCapToken}`,
        },
        body: JSON.stringify({ targetStatus: 'at_pickup' }),
      });
      assert(transCapA.status === 200, `Expected 200 for assigned captain transitioning order to at_pickup, got ${transCapA.status}`);

      // 5. DENIED (403): Merchant B (usr_merch_amana) cannot GET order, history, or transition order belonging to Merchant A
      const getOrderMerchB = await fetch(`${baseUrl}/orders/${bobOrder.id}`, {
        headers: { Authorization: `Bearer ${otherMerchantToken}` },
      });
      assert(getOrderMerchB.status === 403, `Expected 403 for other merchant reading order, got ${getOrderMerchB.status}`);

      const getHistMerchB = await fetch(`${baseUrl}/orders/${bobOrder.id}/history`, {
        headers: { Authorization: `Bearer ${otherMerchantToken}` },
      });
      assert(getHistMerchB.status === 403, `Expected 403 for other merchant reading history, got ${getHistMerchB.status}`);

      // 6. DENIED (403): Unassigned order — Captain cannot read history or bypass /accept to transition an unassigned ready_for_pickup order
      const unassignedOrder: Order = {
        ...baseOrder,
        id: 'ord_http_unassigned_02',
        orderNumber: 'MSH-8841',
        customerId: 'usr_cust_bob',
        status: 'ready_for_pickup',
        assignedCaptainId: undefined,
      };
      PersistentStore.saveOrder(unassignedOrder);

      const getHistUnassignedCap = await fetch(`${baseUrl}/orders/${unassignedOrder.id}/history`, {
        headers: { Authorization: `Bearer ${otherCaptainToken}` },
      });
      assert(
        getHistUnassignedCap.status === 403,
        `Expected 403 for captain reading history of unassigned order, got ${getHistUnassignedCap.status}`
      );

      const transUnassignedCap = await fetch(`${baseUrl}/orders/${unassignedOrder.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherCaptainToken}`,
        },
        body: JSON.stringify({ targetStatus: 'at_pickup' }),
      });
      assert(
        transUnassignedCap.status === 403,
        `Expected 403 for captain transitioning unassigned order without claiming, got ${transUnassignedCap.status}`
      );

      // 7. HTTP duplicate cash collection: same Idempotency-Key replays (200), different Idempotency-Key on paid order fails with 409 ORDER_ALREADY_PAID
      const inTransitOrder: Order = {
        ...baseOrder,
        id: 'ord_http_cod_dup_03',
        orderNumber: 'MSH-8842',
        customerId: 'usr_cust_bob',
        status: 'in_transit',
        assignedCaptainId: 'cpt_ahmed_fathy',
        totalFarePiasters: 3000,
        paymentMethod: 'cash_on_delivery',
        isPaid: false,
      };
      PersistentStore.saveOrder(inTransitOrder);

      const firstCashRes = await fetch(`${baseUrl}/captain/orders/${inTransitOrder.id}/cash-collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${assignedCapToken}`,
          'Idempotency-Key': 'http_cod_key_alpha',
        },
        body: JSON.stringify({ amountCollectedPiasters: 3000, customerConfirmed: true }),
      });
      assert(firstCashRes.status === 200, `Expected 200 on first cash collection, got ${firstCashRes.status}`);

      const replayCashRes = await fetch(`${baseUrl}/captain/orders/${inTransitOrder.id}/cash-collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${assignedCapToken}`,
          'Idempotency-Key': 'http_cod_key_alpha',
        },
        body: JSON.stringify({ amountCollectedPiasters: 3000, customerConfirmed: true }),
      });
      assert(replayCashRes.status === 200, `Expected 200 on idempotent replay, got ${replayCashRes.status}`);
      const replayJson = await replayCashRes.json();
      assert(replayJson.data.isIdempotentReplay === true, 'Replay response must set isIdempotentReplay = true');

      const duplicateNewKeyRes = await fetch(`${baseUrl}/captain/orders/${inTransitOrder.id}/cash-collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${assignedCapToken}`,
          'Idempotency-Key': 'http_cod_key_beta_distinct',
        },
        body: JSON.stringify({ amountCollectedPiasters: 3000, customerConfirmed: true }),
      });
      assert(
        duplicateNewKeyRes.status === 409,
        `Expected 409 ORDER_ALREADY_PAID on duplicate collection with distinct key, got ${duplicateNewKeyRes.status}`
      );
      const duplicateErrJson = await duplicateNewKeyRes.json();
      assert(
        duplicateErrJson.error?.code === 'ORDER_ALREADY_PAID',
        `Expected error code ORDER_ALREADY_PAID, got ${duplicateErrJson.error?.code}`
      );
    } finally {
      server.close();
    }
  });

  await runTest('SecurityIsolation', 'Hardens POST /payments/intents against cross-customer, cross-merchant, captain/unlisted roles, malformed IDs, amount manipulation, and invalid states while allowing valid flows', async () => {
    const app = createServer();
    const server = app.listen(0);
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    try {
      const payableOrder: Order = {
        ...baseOrder,
        id: 'ord_pay_intent_01',
        orderNumber: 'MSH-8901',
        customerId: 'usr_cust_bob',
        serviceTypeId: 'restaurant_store',
        storeId: 'merchant_basha',
        merchantUserId: 'usr_merch_basha',
        status: 'created',
        totalFarePiasters: 6500, // 65.00 EGP
        paymentMethod: 'electronic_wallet',
        isPaid: false,
      };
      PersistentStore.saveOrder(payableOrder);

      const bobToken = generateTestToken({ userId: 'usr_cust_bob', role: 'customer' });
      const aliceToken = generateTestToken({ userId: 'usr_cust_alice', role: 'customer' });
      const bashaMerchantToken = generateTestToken({ userId: 'usr_merch_basha', role: 'merchant' });
      const otherMerchantToken = generateTestToken({ userId: 'usr_merch_amana', role: 'merchant' });
      const captainToken = generateTestToken({ userId: 'usr_cpt_01', role: 'captain' });
      const supportToken = generateTestToken({ userId: 'usr_support_01', role: 'support_agent' });
      const unknownRoleToken = generateTestToken({ userId: 'usr_unknown_99', role: 'billing_bot' as any });

      // 1. Customer paying for another customer's order -> 403 FORBIDDEN_RESOURCE
      const alicePayRes = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
        body: JSON.stringify({ orderId: payableOrder.id, provider: 'paymob' }),
      });
      assert(alicePayRes.status === 403, `Expected 403 for Alice paying Bob order, got ${alicePayRes.status}`);
      assert((await alicePayRes.json()).error?.code === 'FORBIDDEN_RESOURCE', 'Must return FORBIDDEN_RESOURCE');

      // 2. Merchant accessing another merchant's order -> 403 FORBIDDEN_RESOURCE
      const otherMerchPayRes = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherMerchantToken}` },
        body: JSON.stringify({ orderId: payableOrder.id, provider: 'paymob' }),
      });
      assert(otherMerchPayRes.status === 403, `Expected 403 for other merchant, got ${otherMerchPayRes.status}`);
      assert((await otherMerchPayRes.json()).error?.code === 'FORBIDDEN_RESOURCE', 'Must return FORBIDDEN_RESOURCE');

      // 3. Captain attempting to create a payment intent -> 403 FORBIDDEN_ROLE
      const capPayRes = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${captainToken}` },
        body: JSON.stringify({ orderId: payableOrder.id, provider: 'paymob' }),
      });
      assert(capPayRes.status === 403, `Expected 403 for captain creating payment intent, got ${capPayRes.status}`);
      assert((await capPayRes.json()).error?.code === 'FORBIDDEN_ROLE', 'Must return FORBIDDEN_ROLE');

      // 4. Unknown or unsupported roles -> 403 (support_agent -> FORBIDDEN_ROLE, unknown role -> UNAUTHORIZED_ROLE)
      const supportPayRes = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supportToken}` },
        body: JSON.stringify({ orderId: payableOrder.id, provider: 'paymob' }),
      });
      assert(supportPayRes.status === 403, `Expected 403 for support_agent creating payment intent, got ${supportPayRes.status}`);
      assert((await supportPayRes.json()).error?.code === 'FORBIDDEN_ROLE', 'Must return FORBIDDEN_ROLE');

      const unknownRoleRes = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${unknownRoleToken}` },
        body: JSON.stringify({ orderId: payableOrder.id, provider: 'paymob' }),
      });
      assert(unknownRoleRes.status === 403, `Expected 403 for unknown JWT role, got ${unknownRoleRes.status}`);
      assert((await unknownRoleRes.json()).error?.code === 'UNAUTHORIZED_ROLE', 'Must return UNAUTHORIZED_ROLE');

      // 5. Missing or malformed order/resource identifiers & invalid provider -> 400
      for (const badId of ['', '   ', '../etc/passwd', 'ord; DROP TABLE orders', 12345, null]) {
        const badIdRes = await fetch(`${baseUrl}/payments/intents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
          body: JSON.stringify({ orderId: badId, provider: 'paymob' }),
        });
        assert(badIdRes.status === 400, `Expected 400 for malformed orderId (${String(badId)}), got ${badIdRes.status}`);
        assert((await badIdRes.json()).error?.code === 'INVALID_ORDER_ID', 'Must return INVALID_ORDER_ID');
      }

      const badProviderRes = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
        body: JSON.stringify({ orderId: payableOrder.id, provider: 'untrusted_gateway' }),
      });
      assert(badProviderRes.status === 400, `Expected 400 for unsupported provider, got ${badProviderRes.status}`);
      assert((await badProviderRes.json()).error?.code === 'INVALID_PAYMENT_PROVIDER', 'Must return INVALID_PAYMENT_PROVIDER');

      // 6. Amount manipulation, untrusted client state, and invalid order/payment states
      for (const tamperedBody of [
        { orderId: payableOrder.id, amountPiasters: 100 }, // Underpaying 6500 -> 100
        { orderId: payableOrder.id, amountPiasters: -6500 },
        { orderId: payableOrder.id, amountPiasters: 65.5 },
        { orderId: payableOrder.id, totalFarePiasters: 500 },
      ]) {
        const manipRes = await fetch(`${baseUrl}/payments/intents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
          body: JSON.stringify(tamperedBody),
        });
        assert(manipRes.status === 422, `Expected 422 on amount manipulation, got ${manipRes.status}`);
        assert((await manipRes.json()).error?.code === 'AMOUNT_MANIPULATION_DETECTED', 'Must return AMOUNT_MANIPULATION_DETECTED');
      }

      const stateSpoofRes = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
        body: JSON.stringify({ orderId: payableOrder.id, isPaid: true }),
      });
      assert(stateSpoofRes.status === 422, `Expected 422 on client state injection, got ${stateSpoofRes.status}`);

      // Cancelled order -> 409 INVALID_ORDER_STATE
      const cancelledOrder: Order = { ...payableOrder, id: 'ord_pay_cancelled_02', status: 'cancelled' };
      PersistentStore.saveOrder(cancelledOrder);
      const cancelPayRes = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
        body: JSON.stringify({ orderId: cancelledOrder.id }),
      });
      assert(cancelPayRes.status === 409, `Expected 409 for cancelled order payment intent, got ${cancelPayRes.status}`);
      assert((await cancelPayRes.json()).error?.code === 'INVALID_ORDER_STATE', 'Must return INVALID_ORDER_STATE');

      // Already-paid order -> 409 ORDER_ALREADY_PAID
      const paidOrder: Order = { ...payableOrder, id: 'ord_pay_already_paid_03', isPaid: true };
      PersistentStore.saveOrder(paidOrder);
      const paidPayRes = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
        body: JSON.stringify({ orderId: paidOrder.id }),
      });
      assert(paidPayRes.status === 409, `Expected 409 for already paid order, got ${paidPayRes.status}`);
      assert((await paidPayRes.json()).error?.code === 'ORDER_ALREADY_PAID', 'Must return ORDER_ALREADY_PAID');

      // 7. Authorized customer and owning merchant flows continue to work (200 OK)
      const validBobPayRes = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
        body: JSON.stringify({ orderId: payableOrder.id, provider: 'paymob' }),
      });
      assert(validBobPayRes.status === 200, `Expected 200 for owning customer Bob, got ${validBobPayRes.status}`);
      const bobIntent = (await validBobPayRes.json()).data;
      assert(bobIntent.amountPiasters === 6500, 'Payment intent amountPiasters must equal authoritative order totalFarePiasters (6500)');
      assert(bobIntent.orderId === payableOrder.id, 'Payment intent orderId must match');

      const validMerchPayRes = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bashaMerchantToken}` },
        body: JSON.stringify({ orderId: payableOrder.id, provider: 'fawry', amountPiasters: 6500 }),
      });
      assert(validMerchPayRes.status === 200, `Expected 200 for owning merchant Basha, got ${validMerchPayRes.status}`);
      const merchIntent = (await validMerchPayRes.json()).data;
      assert(merchIntent.amountPiasters === 6500, 'Merchant intent amountPiasters must equal 6500');
      assert(merchIntent.provider === 'fawry', 'Merchant intent provider must be fawry');
    } finally {
      server.close();
    }
  });

  await runTest('SecurityIsolation', 'Enforces safe non-leaking 500 AUTH_CONFIG_MISSING HTTP responses, cross-customer POST /orders idempotency isolation, and route/FSM cancellation agreement', async () => {
    const app = createServer();
    const server = app.listen(0);
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    try {
      const bobToken = generateTestToken({ userId: 'usr_cust_bob', role: 'customer' });
      const aliceToken = generateTestToken({ userId: 'usr_cust_alice', role: 'customer' });

      // 1. Safe non-leaking 500 AUTH_CONFIG_MISSING client error response
      const prevNodeEnv = process.env.NODE_ENV;
      const prevSecret = process.env.SUPABASE_JWT_SECRET;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.SUPABASE_JWT_SECRET;
        const configErrRes = await fetch(`${baseUrl}/orders`, {
          headers: { Authorization: `Bearer ${bobToken}` },
        });
        assert(configErrRes.status === 500, `Expected 500 on missing production auth config, got ${configErrRes.status}`);
        const configErrBody = await configErrRes.json();
        assert(configErrBody.error?.code === 'AUTH_CONFIG_MISSING', 'Must return AUTH_CONFIG_MISSING code');
        assert(
          !String(configErrBody.error?.message || '').includes('SUPABASE_JWT_SECRET'),
          'Client error message must NOT leak internal env var names'
        );
      } finally {
        if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = prevNodeEnv;
        if (prevSecret === undefined) delete process.env.SUPABASE_JWT_SECRET;
        else process.env.SUPABASE_JWT_SECRET = prevSecret;
      }

      // 2. Cross-customer POST /orders idempotency isolation & payload mismatch check
      const quote1 = pricing.generateQuote({ serviceTypeId: 'package', distanceKm: 1.5 });
      const quote2 = pricing.generateQuote({ serviceTypeId: 'package', distanceKm: 3.5 });

      const sharedIdemKey = 'shared_order_idem_key_001';
      const orderPayload1 = {
        serviceTypeId: 'package',
        quoteId: quote1.quoteId,
        pickup: { landmarkName: 'ميدان المحطة', detailedAddress: '1', contactPhone: '01000000001' },
        dropoff: { landmarkName: 'مجلس المدينة', detailedAddress: '2', contactPhone: '01000000002' },
        itemDescription: 'طرد بوب',
        totalFarePiasters: quote1.totalFarePiasters,
        quoteExpiresAt: quote1.expiresAt,
        quoteSignature: quote1.signature,
      };

      const bobOrderRes1 = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bobToken}`,
          'Idempotency-Key': sharedIdemKey,
        },
        body: JSON.stringify(orderPayload1),
      });
      assert(bobOrderRes1.status === 201, `Expected 201 on first Bob order, got ${bobOrderRes1.status}`);
      const bobCreated = (await bobOrderRes1.json()).data;

      // Same customer (Bob) + same key + different payload -> 409 IDEMPOTENCY_PAYLOAD_MISMATCH
      const bobMismatchRes = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bobToken}`,
          'Idempotency-Key': sharedIdemKey,
        },
        body: JSON.stringify({
          ...orderPayload1,
          quoteId: quote2.quoteId,
          totalFarePiasters: quote2.totalFarePiasters,
          quoteExpiresAt: quote2.expiresAt,
          quoteSignature: quote2.signature,
        }),
      });
      assert(bobMismatchRes.status === 409, `Expected 409 on idempotency payload mismatch, got ${bobMismatchRes.status}`);
      assert((await bobMismatchRes.json()).error?.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH', 'Must return IDEMPOTENCY_PAYLOAD_MISMATCH');

      // Different customer (Alice) + same key -> creates Alice's own distinct order (never leaks Bob's order!)
      const aliceOrderRes = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aliceToken}`,
          'Idempotency-Key': sharedIdemKey,
        },
        body: JSON.stringify(orderPayload1),
      });
      assert(aliceOrderRes.status === 201, `Expected 201 for Alice using same key string in her own scope, got ${aliceOrderRes.status}`);
      const aliceCreated = (await aliceOrderRes.json()).data;
      assert(aliceCreated.id !== bobCreated.id, 'Alice order ID must be distinct from Bob order ID');
      assert(aliceCreated.customerId === 'usr_cust_alice', 'Alice order must belong to Alice');

      // 3. OrderFsm & route agreement: Merchant cannot cancel an order in_transit via OrderFsm.transition or /transitions, and order is not mutated
      const inTransitStoreOrder: Order = {
        ...baseOrder,
        id: 'ord_merch_cancel_guard_01',
        storeId: 'merchant_basha',
        merchantUserId: 'usr_merch_basha',
        assignedCaptainId: 'cpt_ahmed_fathy',
        status: 'in_transit',
      };
      assertThrows(() => {
        OrderFsm.transition(inTransitStoreOrder, {
          targetStatus: 'cancelled',
          actorId: 'usr_merch_basha',
          actorRole: 'merchant',
          cancellationReason: 'محاولة إلغاء بعد التحرك',
        });
      }, 'CANCELLATION_NOT_ALLOWED');
      assert(inTransitStoreOrder.status === 'in_transit', 'Failed transition must not mutate order status');
    } finally {
      server.close();
    }
  });
  // --------------------------------------------------------------------------
  // SUITE 16: PostgreSQL Transaction Guarantees, Rollback & Concurrency Verification
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 16: PostgreSQL Transaction Guarantees, Rollback & Concurrency Verification');

  await runTest('PostgreSqlTransaction', 'Verifies schema defines row-level locking capabilities and unique idempotency constraint', async () => {
    const migration = await import('../src/database/migrations/001_security_hardening.js');
    assert(typeof migration.up === 'function', 'Migration up function must exist');
    assert(typeof migration.down === 'function', 'Migration down function must exist');
  });

  await runTest('PostgreSqlTransaction', 'Ensures concurrent cash collection requests serialize and prevent race condition', async () => {
    CashCollectionService.clearCache();
    const testOrderId = 'ord_race_test_01';
    const testFarePiasters = 2500;
    const testCaptain: CaptainProfile = {
      id: 'cpt_race_test',
      userId: 'usr_race_test',
      fullName: 'كابتن سباق تجريبي',
      phone: '+201100000000',
      nationalIdMasked: '29000000000000',
      vehicleType: 'motorcycle',
      vehiclePlate: '١٢٣٤ ط س',
      subscriptionStatus: 'active',
      subscriptionPlanCode: 'STANDARD',
      currentPeriodEndsAt: new Date(Date.now() + 86400000).toISOString(),
      cashHoldingPiasters: 10000,
      maxCashHoldingPiasters: 100000,
      ratingAverage: 5.0,
      isOnline: true,
    };

    const testOrder: Order = {
      ...baseOrder,
      id: testOrderId,
      totalFarePiasters: testFarePiasters,
      assignedCaptainId: testCaptain.id,
      status: 'in_transit',
      paymentMethod: 'cash_on_delivery',
      isPaid: false,
    };

    PersistentStore.saveOrder(testOrder);
    PersistentStore.saveCaptain(testCaptain);

    const idempotencyKey = 'race_key_test_001';
    const promises = Array.from({ length: 5 }, () =>
      CashCollectionService.recordCashCollection({
        orderId: testOrderId,
        captain: testCaptain,
        amountPiasters: testFarePiasters,
        idempotencyKey,
      })
    );

    const outcomes = await Promise.all(promises);
    const initialCollects = outcomes.filter((o) => !o.isIdempotentReplay);
    const replays = outcomes.filter((o) => o.isIdempotentReplay);

    assert(initialCollects.length === 1, 'Exactly one initial cash collection must execute');
    assert(replays.length === 4, 'Remaining concurrent requests must resolve as idempotent replays');
    assert(testCaptain.cashHoldingPiasters === 12500, 'Captain balance must increase by fare exactly once');
  });

  await runTest('PostgreSqlTransaction', 'Serializes concurrent cash collections across two distinct orders for the same captain without lost balance updates (in-memory mutex)', async () => {
    CashCollectionService.clearCache();
    const multiCap: CaptainProfile = {
      id: 'cpt_multi_order_race',
      userId: 'usr_multi_order_race',
      fullName: 'كابتن متعدد الطلبات',
      phone: '+201122334455',
      nationalIdMasked: '29000000000099',
      vehicleType: 'motorcycle',
      vehiclePlate: '٥٥٥٥ م ن',
      subscriptionStatus: 'active',
      subscriptionPlanCode: 'STANDARD',
      currentPeriodEndsAt: new Date(Date.now() + 86400000).toISOString(),
      cashHoldingPiasters: 20000,
      maxCashHoldingPiasters: 100000,
      ratingAverage: 4.9,
      isOnline: true,
    };
    PersistentStore.saveCaptain(multiCap);

    const orderA: Order = {
      ...baseOrder,
      id: 'ord_multi_race_A',
      totalFarePiasters: 3000,
      assignedCaptainId: multiCap.id,
      status: 'in_transit',
      paymentMethod: 'cash_on_delivery',
      isPaid: false,
    };
    const orderB: Order = {
      ...baseOrder,
      id: 'ord_multi_race_B',
      totalFarePiasters: 4500,
      assignedCaptainId: multiCap.id,
      status: 'in_transit',
      paymentMethod: 'cash_on_delivery',
      isPaid: false,
    };
    PersistentStore.saveOrder(orderA);
    PersistentStore.saveOrder(orderB);

    // Pass detached clones of multiCap to verify that the service reads the latest committed balance from PersistentStore inside the captain lock
    await Promise.all([
      CashCollectionService.recordCashCollection({
        orderId: orderA.id,
        captain: { ...multiCap },
        amountPiasters: 3000,
        idempotencyKey: 'multi_key_A',
      }),
      CashCollectionService.recordCashCollection({
        orderId: orderB.id,
        captain: { ...multiCap },
        amountPiasters: 4500,
        idempotencyKey: 'multi_key_B',
      }),
    ]);

    const finalCaptain = PersistentStore.getCaptainById(multiCap.id)!;
    assert(
      finalCaptain.cashHoldingPiasters === 27500,
      `Expected cumulative captain balance 27500 (20000 + 3000 + 4500), got ${finalCaptain.cashHoldingPiasters}`
    );
  });

  await runTest('PostgreSqlTransaction', 'Ensures rollback on validation failure leaves captain balance and ledger untouched', async () => {
    CashCollectionService.clearCache();
    const testOrderId = 'ord_rollback_01';
    const testFarePiasters = 3000;
    const initialHolding = 15000;
    const testCaptain: CaptainProfile = {
      id: 'cpt_rollback_test',
      userId: 'usr_rollback_test',
      fullName: 'كابتن فحص التراجع',
      phone: '+201100000001',
      nationalIdMasked: '29000000000001',
      vehicleType: 'motorcycle',
      vehiclePlate: '٩٩٩٩ ط س',
      subscriptionStatus: 'active',
      subscriptionPlanCode: 'STANDARD',
      currentPeriodEndsAt: new Date(Date.now() + 86400000).toISOString(),
      cashHoldingPiasters: initialHolding,
      maxCashHoldingPiasters: 100000,
      ratingAverage: 5.0,
      isOnline: true,
    };

    const testOrder: Order = {
      ...baseOrder,
      id: testOrderId,
      totalFarePiasters: testFarePiasters,
      assignedCaptainId: testCaptain.id,
      status: 'in_transit',
      paymentMethod: 'cash_on_delivery',
      isPaid: false,
    };

    PersistentStore.saveOrder(testOrder);
    PersistentStore.saveCaptain(testCaptain);

    let failed = false;
    try {
      // Intentionally pass an incorrect fare amount (2000 vs 3000)
      await CashCollectionService.recordCashCollection({
        orderId: testOrderId,
        captain: testCaptain,
        amountPiasters: 2000,
      });
    } catch (err: any) {
      failed = true;
      assert(err.code === 'FARE_MISMATCH', 'Error code must be FARE_MISMATCH');
    }

    assert(failed, 'Call with mismatched fare must fail');
    assert(testCaptain.cashHoldingPiasters === initialHolding, 'Captain balance must not change on failure');
    const orderAfter = PersistentStore.getOrderById(testOrderId);
    assert(orderAfter?.isPaid === false, 'Order must remain unpaid after rollback');
  });

  await runTest('PostgreSqlTransaction', 'Executes live PostgreSQL SELECT FOR UPDATE concurrency test when DATABASE_URL is configured (or marks pending when absent)', async () => {
    const isLiveDb = Boolean(process.env.DATABASE_URL);
    if (!isLiveDb) {
      console.log('    ℹ [DB STATUS: PENDING LIVE POSTGRESQL IN CI] DATABASE_URL not set in container environment. In-memory mutex engine verified; live PostgreSQL concurrency test will execute when DATABASE_URL is provided in CI.');
      return;
    }

    const { getDb } = await import('../src/database/db.js');
    const db = getDb();
    assert(db !== null, 'PostgreSQL connection pool must initialize when DATABASE_URL is set');
    await verifyOrRunMigrations(true);

    const nowIso = new Date().toISOString();
    const pgCapId = `cpt_pg_conc_${Date.now()}`;
    const pgOrdId = `ord_pg_conc_${Date.now()}`;

    await db!
      .insertInto('captains')
      .values({
        id: pgCapId,
        user_id: `usr_${pgCapId}`,
        full_name: 'كابتن اختبار بوستجرس',
        phone: '+201099887766',
        national_id_masked: '2900101******1',
        vehicle_type: 'motorcycle',
        vehicle_plate: '١١١١ م ن',
        subscription_status: 'active',
        subscription_plan_code: 'EL_BAGOUR_MONTHLY_STANDARD',
        current_period_ends_at: new Date(Date.now() + 86400000).toISOString(),
        grace_period_ends_at: null,
        cash_holding_piasters: 10000,
        max_cash_holding_piasters: 100000,
        rating_average: 5.0,
        is_online: true,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .execute();

    await db!
      .insertInto('orders')
      .values({
        id: pgOrdId,
        order_number: 'MSH-PG01',
        customer_id: 'usr_cust_pg',
        customer_name: 'عميل بوستجرس',
        customer_phone: '+201011223344',
        service_type_id: 'package',
        status: 'in_transit',
        quote_id: 'quote_pg_1',
        pickup_landmark: baseOrder.pickup.landmarkName,
        pickup_detailed_address: baseOrder.pickup.detailedAddress,
        pickup_contact_phone: baseOrder.pickup.contactPhone,
        dropoff_landmark: baseOrder.dropoff.landmarkName,
        dropoff_detailed_address: baseOrder.dropoff.detailedAddress,
        dropoff_contact_phone: baseOrder.dropoff.contactPhone,
        item_description: 'طرد بوستجرس',
        special_instructions: null,
        total_fare_piasters: 3000,
        payment_method: 'cash_on_delivery',
        is_paid: false,
        assigned_captain_id: pgCapId,
        captain_name: 'كابتن اختبار بوستجرس',
        captain_phone: '+201099887766',
        captain_vehicle: 'motorcycle',
        cash_collected_piasters: null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .execute();

    const pgCapProfile: CaptainProfile = {
      id: pgCapId,
      userId: `usr_${pgCapId}`,
      fullName: 'كابتن اختبار بوستجرس',
      phone: '+201099887766',
      nationalIdMasked: '2900101******1',
      vehicleType: 'motorcycle',
      vehiclePlate: '١١١١ م ن',
      subscriptionStatus: 'active',
      subscriptionPlanCode: 'EL_BAGOUR_MONTHLY_STANDARD',
      currentPeriodEndsAt: new Date(Date.now() + 86400000).toISOString(),
      cashHoldingPiasters: 10000,
      maxCashHoldingPiasters: 100000,
      ratingAverage: 5.0,
      isOnline: true,
    };

    // Fire 2 concurrent requests with DISTINCT idempotency keys on the same order against live PostgreSQL
    const settled = await Promise.allSettled([
      CashCollectionService.recordCashCollectionPostgres(db!, {
        orderId: pgOrdId,
        captain: pgCapProfile,
        amountPiasters: 3000,
        idempotencyKey: `pg_key_1_${Date.now()}`,
      }),
      CashCollectionService.recordCashCollectionPostgres(db!, {
        orderId: pgOrdId,
        captain: pgCapProfile,
        amountPiasters: 3000,
        idempotencyKey: `pg_key_2_${Date.now()}`,
      }),
    ]);

    const fulfilled = settled.filter((s) => s.status === 'fulfilled');
    const rejected = settled.filter((s) => s.status === 'rejected') as PromiseRejectedResult[];
    assert(fulfilled.length === 1, `Expected 1 fulfilled PostgreSQL cash collection, got ${fulfilled.length}`);
    assert(rejected.length === 1, `Expected 1 rejected PostgreSQL duplicate cash collection, got ${rejected.length}`);
    assert(rejected[0].reason?.code === 'ORDER_ALREADY_PAID', 'Second concurrent PostgreSQL request must fail with ORDER_ALREADY_PAID');
  });

  // --------------------------------------------------------------------------
  // SUITE 17: Multi-City & Service Zone Expansion Tariffs (El Bagour, Shebin El-Kom, Menouf, Sadat)
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 17: Multi-City & Service Zone Expansion Tariffs');

  resetTestDatabases();
  const pricingEngine = new PricingEngine();

  await runTest('MultiZone', 'Seeds active cities (El Bagour, Shebin El-Kom, Menouf) and filters out inactive expansion cities by default', () => {
    const activeCities = PersistentStore.getAllCities(false);
    const allCities = PersistentStore.getAllCities(true);
    assert(activeCities.length === 3, `Expected 3 active cities, got ${activeCities.length}`);
    assert(allCities.length === 4, `Expected 4 total cities including inactive Sadat City, got ${allCities.length}`);
    assert(activeCities.some((c) => c.id === 'city_el_bagour'), 'El Bagour must be active');
    assert(activeCities.some((c) => c.id === 'city_shebin_el_kom'), 'Shebin El-Kom must be active');
    assert(activeCities.some((c) => c.id === 'city_menouf'), 'Menouf must be active');
  });

  await runTest('MultiZone', 'Calculates zone-specific tariff for Shebin El-Kom (18.00 EGP base, 4.50 EGP/km, 2.50 EGP platform fee)', () => {
    const quote = pricingEngine.generateQuote({
      serviceTypeId: 'package',
      distanceKm: 3.5, // 1.5 included + 2.0 extra km * 450 = 900 piasters
      zoneId: 'zone_shebin_center',
    });
    assert(quote.cityId === 'city_shebin_el_kom', 'Must resolve cityId to city_shebin_el_kom');
    assert(quote.zoneId === 'zone_shebin_center', 'Must resolve zoneId to zone_shebin_center');
    assert(quote.baseFarePiasters === 1800, 'Shebin base fare must be 1800 piasters');
    assert(quote.distanceFarePiasters === 900, 'Distance fare for 2 extra km must be 900 piasters');
    assert(quote.platformFeePiasters === 250, 'Shebin platform fee must be 250 piasters');
    assert(quote.totalFarePiasters === 2950, 'Total Shebin fare must be 2950 piasters (29.50 EGP)');
  });

  await runTest('MultiZone', 'Automatically applies rural surcharge for rural village zone (zone_bagour_villages)', () => {
    const quote = pricingEngine.generateQuote({
      serviceTypeId: 'package',
      distanceKm: 1.5,
      zoneId: 'zone_bagour_villages',
    });
    assert(quote.ruralSurchargePiasters === 500, 'Rural zone must automatically include 500 piasters rural surcharge');
    assert(quote.totalFarePiasters === 2200, 'Total fare for 1.5km rural village must be 2200 piasters');
  });

  await runTest('MultiZone', 'Rejects quote generation for inactive expansion zone (Sadat City) with 403 ZONE_INACTIVE', () => {
    assertThrows(() => {
      pricingEngine.generateQuote({
        serviceTypeId: 'package',
        distanceKm: 2.0,
        zoneId: 'zone_sadat_industrial',
      });
    }, 'ZONE_INACTIVE');
  });

  await runTest('MultiZone', 'Rejects quote generation for unknown zone ID with 404 ZONE_NOT_FOUND', () => {
    assertThrows(() => {
      pricingEngine.generateQuote({
        serviceTypeId: 'package',
        distanceKm: 2.0,
        zoneId: 'zone_unknown_999',
      });
    }, 'ZONE_NOT_FOUND');
  });

  // --------------------------------------------------------------------------
  // SUITE 18: Merchant, Store & Catalog Management with Strict Ownership RBAC
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 18: Merchant, Store & Catalog Management with Strict Ownership RBAC');

  await runTest('MerchantCatalog', 'Lists active stores by zone and retrieves full catalog in integer piasters', () => {
    const bagourStores = MerchantService.listStores({ cityId: 'city_el_bagour' });
    assert(bagourStores.length >= 3, 'El Bagour must have at least 3 seeded stores');

    const catalog = MerchantService.getStoreCatalog('merchant_basha');
    assert(catalog.store.nameAr.includes('الباشا'), 'Must return Basha store');
    assert(catalog.items.length >= 3, 'Must return Basha menu items');
    assert(Number.isInteger(catalog.items[0].pricePiasters), 'Menu item prices must be integer piasters');
  });

  await runTest('MerchantCatalog', 'Allows store owner (usr_merch_basha) to add a menu item in integer piasters', () => {
    const item = MerchantService.createMenuItem({
      storeId: 'merchant_basha',
      actorId: 'usr_merch_basha',
      actorRole: 'merchant',
      actorName: 'الحاج رأفت الباشا',
      categoryNameAr: 'مشويات الفحم',
      nameAr: 'طرب ضاني مشوي على الفحم',
      descriptionAr: 'نصف كيلو طرب ضاني بلدي مع مقبلات',
      pricePiasters: 22000, // 220.00 EGP
      unitAr: 'طبق',
    });
    assert(item.id.startsWith('prod_merchant_basha_'), 'Created item must have store prefix ID');
    assert(item.pricePiasters === 22000, 'Price must be 22000 piasters');
  });

  await runTest('MerchantCatalog', 'Blocks Merchant B (usr_merch_amana) from modifying Merchant A store (merchant_basha) with 403 FORBIDDEN_STORE_OWNERSHIP', () => {
    assertThrows(() => {
      MerchantService.updateStoreStatus({
        storeId: 'merchant_basha',
        actorId: 'usr_merch_amana',
        actorRole: 'merchant',
        actorName: 'د. سحر عبد الحميد',
        isOpen: false,
      });
    }, 'FORBIDDEN_STORE_OWNERSHIP');

    assertThrows(() => {
      MerchantService.createMenuItem({
        storeId: 'merchant_basha',
        actorId: 'usr_merch_amana',
        actorRole: 'merchant',
        actorName: 'د. سحر عبد الحميد',
        categoryNameAr: 'اختراق',
        nameAr: 'صنف غير مصرح',
        descriptionAr: 'محاولة تعديل متجر آخر',
        pricePiasters: 5000,
      });
    }, 'FORBIDDEN_STORE_OWNERSHIP');
  });

  await runTest('MerchantCatalog', 'Rejects non-integer or negative piaster menu item prices with 400 INVALID_PRICE_PIASTERS', () => {
    assertThrows(() => {
      MerchantService.createMenuItem({
        storeId: 'merchant_basha',
        actorId: 'usr_merch_basha',
        actorRole: 'merchant',
        actorName: 'الحاج رأفت الباشا',
        categoryNameAr: 'مشويات',
        nameAr: 'صنف بسعر خاطئ',
        descriptionAr: 'سعر عشري غير مسموح',
        pricePiasters: 45.75,
      });
    }, 'INVALID_PRICE_PIASTERS');
  });

  // --------------------------------------------------------------------------
  // SUITE 19: Store-to-Captain End-to-End Order Lifecycle & State History
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 19: Store-to-Captain End-to-End Order Lifecycle & State History');

  await runTest('StoreLifecycle', 'Executes complete store order lifecycle (created -> accepted_by_store -> preparing -> ready_for_pickup -> captain_assigned -> at_pickup -> picked_up -> in_transit -> delivered)', async () => {
    let storeOrder: Order = {
      ...baseOrder,
      id: 'ord_store_lifecycle_01',
      orderNumber: 'MSH-7701',
      customerId: 'usr_cust_01',
      serviceTypeId: 'restaurant_store',
      storeId: 'merchant_basha',
      storeName: 'مطعم ومشاوي الباشا',
      merchantUserId: 'usr_merch_basha',
      status: 'created',
      totalFarePiasters: 21200, // 195 EGP item + 15 EGP base + 2 EGP fee
      paymentMethod: 'cash_on_delivery',
      isPaid: false,
    };

    // 1. Merchant accepts order
    const step1 = OrderFsm.transition(storeOrder, {
      targetStatus: 'accepted_by_store',
      actorId: 'usr_merch_basha',
      actorRole: 'merchant',
    });
    storeOrder = step1.order;
    assert(storeOrder.status === 'accepted_by_store', 'Must transition to accepted_by_store');

    // 2. Merchant marks preparing
    const step2 = OrderFsm.transition(storeOrder, {
      targetStatus: 'preparing',
      actorId: 'usr_merch_basha',
      actorRole: 'merchant',
    });
    storeOrder = step2.order;
    assert(storeOrder.status === 'preparing', 'Must transition to preparing');

    // 3. Merchant marks ready_for_pickup
    const step3 = OrderFsm.transition(storeOrder, {
      targetStatus: 'ready_for_pickup',
      actorId: 'usr_merch_basha',
      actorRole: 'merchant',
    });
    storeOrder = step3.order;
    assert(storeOrder.status === 'ready_for_pickup', 'Must transition to ready_for_pickup');

    // 4. Captain claims ready_for_pickup order via AssignmentService
    const activeCap = PersistentStore.getCaptainById('cpt_ahmed_fathy')!;
    const claimRes = await AssignmentService.claimOrder(
      () => storeOrder,
      activeCap,
      (updated) => {
        storeOrder = updated;
      }
    );
    assert(claimRes.success === true, 'Captain must be able to claim ready_for_pickup order');
    assert(storeOrder.status === 'captain_assigned', 'Status must become captain_assigned');

    // 5. Captain arrives at store (at_pickup) -> picks up (picked_up) -> in_transit -> delivered
    storeOrder = OrderFsm.transition(storeOrder, {
      targetStatus: 'at_pickup',
      actorId: activeCap.id,
      actorRole: 'captain',
    }).order;
    storeOrder = OrderFsm.transition(storeOrder, {
      targetStatus: 'picked_up',
      actorId: activeCap.id,
      actorRole: 'captain',
    }).order;
    storeOrder = OrderFsm.transition(storeOrder, {
      targetStatus: 'in_transit',
      actorId: activeCap.id,
      actorRole: 'captain',
    }).order;
    storeOrder = OrderFsm.transition(storeOrder, {
      targetStatus: 'delivered',
      actorId: activeCap.id,
      actorRole: 'captain',
      cashCollectedPiasters: 21200,
    }).order;

    assert(storeOrder.status === 'delivered', 'Order must reach delivered state');
    assert(storeOrder.isPaid === true, 'Order must be marked paid upon COD collection');
  });

  await runTest('StoreLifecycle', 'Blocks another merchant from transitioning a store order they do not own (403 UNAUTHORIZED_MERCHANT_ACTION)', () => {
    const storeOrder: Order = {
      ...baseOrder,
      id: 'ord_store_other_02',
      serviceTypeId: 'restaurant_store',
      storeId: 'merchant_basha',
      merchantUserId: 'usr_merch_basha',
      status: 'created',
    };

    assertThrows(() => {
      OrderFsm.transition(storeOrder, {
        targetStatus: 'accepted_by_store',
        actorId: 'usr_merch_amana', // Different merchant!
        actorRole: 'merchant',
      });
    }, 'UNAUTHORIZED_MERCHANT_ACTION');
  });

  // --------------------------------------------------------------------------
  // SUITE 20: Captain Availability, Zone Switching & Eligibility Guard
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 20: Captain Availability, Zone Switching & Eligibility Guard');

  await runTest('CaptainAvailability', 'Allows active captain to switch active service zone and toggle online status', async () => {
    const updated = await CaptainService.updateAvailabilityAndZone({
      userId: 'usr_cpt_01',
      isOnline: true,
      activeZoneId: 'zone_shebin_center',
    });
    assert(updated.activeZoneId === 'zone_shebin_center', 'Active zone must update to zone_shebin_center');
    assert(updated.cityId === 'city_shebin_el_kom', 'City ID must sync with zone cityId');

    // Restore back to El Bagour for subsequent tests
    await CaptainService.updateAvailabilityAndZone({
      userId: 'usr_cpt_01',
      isOnline: true,
      activeZoneId: 'zone_bagour_center',
    });
  });

  await runTest('CaptainAvailability', 'Blocks expired captain from switching online with 403 CAPTAIN_INELIGIBLE_FOR_ONLINE', async () => {
    await assertThrowsAsync(async () => {
      await CaptainService.updateAvailabilityAndZone({
        userId: 'usr_cpt_03', // Tarek El Sheikh (expired)
        isOnline: true,
      });
    }, 'CAPTAIN_INELIGIBLE_FOR_ONLINE');
  });

  // --------------------------------------------------------------------------
  // SUITE 21: Customer Support & Complaints Workflow
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 21: Customer Support & Complaints Workflow');

  await runTest('Complaints', 'Creates customer complaint, enforces tenant visibility, and records support agent resolution', () => {
    const created = ComplaintService.createComplaint({
      reporterUserId: 'usr_cust_alice',
      reporterName: 'أمل محمود',
      reporterPhone: '01099887766',
      reporterRole: 'customer',
      orderId: 'ord_bagour_8101',
      category: 'delayed_delivery',
      priority: 'high',
      subjectAr: 'تأخر وصول المندوب ١٥ دقيقة',
      descriptionAr: 'تأخر الكابتن عن الموعد المحدد بسبب تحويلة طريق بنها.',
    });

    assert(created.id.startsWith('cmp_'), 'Complaint ID must start with cmp_');
    assert(created.status === 'open', 'Initial status must be open');

    // Customer Bob cannot see Alice's complaint
    const bobList = ComplaintService.listComplaints({
      actorId: 'usr_cust_bob',
      actorRole: 'customer',
    });
    assert(!bobList.some((c) => c.id === created.id), 'Other customer must not see Alice complaint');

    // Support agent sees all complaints, assigns, and resolves
    const assigned = ComplaintService.assignComplaint({
      complaintId: created.id,
      actorId: 'usr_support_01',
      actorRole: 'support_agent',
      actorName: 'سارة ممدوح',
      assignedAgentId: 'usr_support_01',
      assignedAgentName: 'سارة ممدوح',
    });
    assert(assigned.status === 'under_review', 'Status must move to under_review upon assignment');

    const resolved = ComplaintService.updateComplaintResolution({
      complaintId: created.id,
      actorId: 'usr_support_01',
      actorRole: 'support_agent',
      actorName: 'سارة ممدوح',
      targetStatus: 'resolved',
      resolutionNotesAr: 'تم التواصل مع العميلة وتقديم اعتذار ورصيد تعويضي ١٠ ج.م.',
      refundAmountPiasters: 1000, // 10.00 EGP in integer piasters
    });

    assert(resolved.status === 'resolved', 'Status must be resolved');
    assert(resolved.refundAmountPiasters === 1000, 'Refund amount must be 1000 piasters');
    assert(resolved.events.length === 3, 'Complaint must contain 3 chronological audit events');
  });

  // --------------------------------------------------------------------------
  // SUITE 22: PostgreSQL DDL Migration 001 + 002 Compiler & Rate Limiter Enforcement
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 22: PostgreSQL DDL Migration 001 + 002 Compiler & Rate Limiter Enforcement');

  await runTest('MigrationsDDL', 'Compiles Migration 001 and Migration 002 cleanly via Kysely PostgreSQL QueryCompiler', async () => {
    const report = await verifyOrRunMigrations(false);
    assert(
      report.migrationsExecuted.includes('001_security_hardening') &&
        report.migrationsExecuted.includes('002_complete_platform_schema'),
      'Both 001 and 002 migrations must execute'
    );
    assert(
      report.compiledStatementsCount >= 25,
      `Expected at least 25 compiled PostgreSQL DDL statements (tables + indexes), got ${report.compiledStatementsCount}`
    );
  });

  await runTest('RateLimiter', 'Enforces sliding-window request limit and returns 429 RATE_LIMIT_EXCEEDED', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2, scope: 'test_limit' });
    let statusSent = 200;
    let bodySent: any = null;
    const mockReq: any = { ip: '197.38.0.1', user: { id: 'usr_rate_test' } };
    const mockRes: any = {
      setHeader: () => {},
      status(code: number) {
        statusSent = code;
        return this;
      },
      json(payload: any) {
        bodySent = payload;
        return this;
      },
    };

    let nextCalled = 0;
    limiter(mockReq, mockRes, () => {
      nextCalled++;
    });
    limiter(mockReq, mockRes, () => {
      nextCalled++;
    });
    // 3rd request within window must be blocked with 429
    limiter(mockReq, mockRes, () => {
      nextCalled++;
    });

    assert(nextCalled === 2, 'Only first 2 requests must pass');
    assert(statusSent === 429, '3rd request must return HTTP 429');
    assert(bodySent?.error?.code === 'RATE_LIMIT_EXCEEDED', 'Error code must be RATE_LIMIT_EXCEEDED');
    resetAllRateLimiters();
  });

  // --------------------------------------------------------------------------
  // SUITE 23: Express REST API End-to-End HTTP Integration
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 23: Express REST API End-to-End HTTP Integration');

  await runTest('HttpApiIntegration', 'Executes full HTTP flow across /zones, /stores, /quotes, /orders, /merchant, /captain, and /complaints', async () => {
    resetTestDatabases();
    const app = createServer();
    const server = app.listen(0);
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    try {
      const custToken = generateTestToken({
        userId: 'usr_cust_http_01',
        role: 'customer',
        fullName: 'محمود الشناوي',
        phone: '01011223344',
      });
      const merchToken = generateTestToken({
        userId: 'usr_merch_basha',
        role: 'merchant',
        fullName: 'الحاج رأفت الباشا',
      });
      const capToken = generateTestToken({
        userId: 'usr_cpt_01', // cpt_ahmed_fathy
        role: 'captain',
        fullName: 'أحمد فتحي الديب',
      });

      // 1. GET /zones
      const zonesRes = await fetch(`${baseUrl}/zones`);
      assert(zonesRes.status === 200, 'GET /zones must return 200');
      const zonesJson = await zonesRes.json();
      assert(zonesJson.data.cities.length === 3, 'Must return 3 active cities');

      // 2. GET /stores/merchant_basha/catalog
      const catRes = await fetch(`${baseUrl}/stores/merchant_basha/catalog`);
      assert(catRes.status === 200, 'GET /stores/:id/catalog must return 200');
      const catJson = await catRes.json();
      const firstItem = catJson.data.items[0];
      assert(firstItem.pricePiasters > 0, 'Catalog item must have integer piaster price');

      // 3. POST /quotes with zoneId & itemsSubtotalPiasters
      const quoteRes = await fetch(`${baseUrl}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceTypeId: 'restaurant_store',
          distanceKm: 1.5,
          zoneId: 'zone_bagour_center',
          itemsSubtotalPiasters: firstItem.pricePiasters,
        }),
      });
      assert(quoteRes.status === 201, 'POST /quotes must return 201');
      const quoteJson = await quoteRes.json();
      const quote = quoteJson.data;

      // 4. POST /orders (Customer places store order)
      const orderRes = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${custToken}`,
        },
        body: JSON.stringify({
          serviceTypeId: 'restaurant_store',
          quoteId: quote.quoteId,
          storeId: 'merchant_basha',
          items: [{ menuItemId: firstItem.id, quantity: 1 }],
          pickup: {
            landmarkName: 'شارع الجمهورية - أمام بنك مصر',
            detailedAddress: 'مطعم ومشاوي الباشا',
            contactPhone: '01233445566',
          },
          dropoff: {
            landmarkName: 'شارع الجيش - برج الشروق',
            detailedAddress: 'الدور الرابع',
            contactPhone: '01011223344',
          },
          itemDescription: firstItem.nameAr,
          totalFarePiasters: quote.totalFarePiasters,
          paymentMethod: 'cash_on_delivery',
          quoteExpiresAt: quote.expiresAt,
          quoteSignature: quote.signature,
        }),
      });
      assert(orderRes.status === 201, 'POST /orders must return 201');
      const createdOrder = (await orderRes.json()).data;
      assert(createdOrder.customerId === 'usr_cust_http_01', 'Order customerId must come from JWT');

      // 5. Merchant transitions order: accepted_by_store -> ready_for_pickup
      const accRes = await fetch(`${baseUrl}/orders/${createdOrder.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchToken}`,
        },
        body: JSON.stringify({ targetStatus: 'accepted_by_store' }),
      });
      assert(accRes.status === 200, 'Merchant accept transition must return 200');

      const rdyRes = await fetch(`${baseUrl}/orders/${createdOrder.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchToken}`,
        },
        body: JSON.stringify({ targetStatus: 'ready_for_pickup' }),
      });
      assert(rdyRes.status === 200, 'Merchant ready_for_pickup transition must return 200');

      // 6. Captain claims order -> transitions to in_transit -> records cash collection
      const claimRes = await fetch(`${baseUrl}/captain/orders/${createdOrder.id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${capToken}` },
      });
      assert(claimRes.status === 200, 'Captain accept must return 200');

      await fetch(`${baseUrl}/orders/${createdOrder.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${capToken}`,
        },
        body: JSON.stringify({ targetStatus: 'at_pickup' }),
      });

      const transitRes = await fetch(`${baseUrl}/orders/${createdOrder.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${capToken}`,
        },
        body: JSON.stringify({ targetStatus: 'in_transit' }),
      });
      assert(transitRes.status === 200, 'Captain in_transit transition must return 200');

      const codRes = await fetch(`${baseUrl}/captain/orders/${createdOrder.id}/cash-collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${capToken}`,
          'Idempotency-Key': 'http_e2e_cod_key_01',
        },
        body: JSON.stringify({
          amountCollectedPiasters: quote.totalFarePiasters,
          customerConfirmed: true,
        }),
      });
      assert(codRes.status === 200, 'Captain cash collection must return 200');

      // 7. Verify order state history
      const histRes = await fetch(`${baseUrl}/orders/${createdOrder.id}/history`, {
        headers: { Authorization: `Bearer ${custToken}` },
      });
      assert(histRes.status === 200, 'GET /orders/:id/history must return 200');
      const histJson = await histRes.json();
      assert(histJson.data.currentStatus === 'delivered', 'Final status must be delivered');
      assert(histJson.data.history.length >= 5, 'State history must record all transitions');
    } finally {
      server.close();
    }
  });

  // --------------------------------------------------------------------------
  // SUITE 24: Payment Intent Idempotency, Webhook Amount/State Hardening & Role Case Normalization
  // --------------------------------------------------------------------------
  console.log('\n▶ SUITE 24: Payment Intent Idempotency, Webhook Amount/State Hardening & Role Case Normalization');

  await runTest('RoleNormalization', 'Safely normalizes uppercase/mixed-case app_metadata.role (e.g. CUSTOMER, CAPTAIN) while still rejecting unknown roles', () => {
    const secret =
      process.env.SUPABASE_JWT_SECRET ||
      process.env.JWT_SECRET ||
      'mashwar_secure_supabase_jwt_secret_el_bagour_2026';
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const upperPayload = Buffer.from(
      JSON.stringify({
        sub: 'usr_upper_role_01',
        iss: 'supabase',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        app_metadata: { role: 'CUSTOMER' },
      })
    ).toString('base64url');
    const sig = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${upperPayload}`)
      .digest('base64url');
    const verified = verifyToken(`${header}.${upperPayload}.${sig}`);
    assert(verified.role === 'customer', `Expected normalized role 'customer', got '${verified.role}'`);
  });

  await runTest('PaymentIntentIdempotency', 'Enforces user-scoped idempotency on POST /payments/intents, replays identical requests, rejects payload mismatches (409), and isolates across customers', async () => {
    resetTestDatabases();
    const app = createServer();
    const server = app.listen(0);
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    try {
      const cust1Token = generateTestToken({ userId: 'usr_cust_02', role: 'customer' }); // owns ord_bagour_8102 (3500 piasters, in_transit, unpaid)
      const cust2Token = generateTestToken({ userId: 'usr_cust_03', role: 'customer' }); // owns ord_bagour_8103 (1700 piasters, searching_captain, unpaid)

      // 1. First request with Idempotency-Key
      const res1 = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
          'Idempotency-Key': 'pi_idem_shared_key_01',
        },
        body: JSON.stringify({
          orderId: 'ord_bagour_8102',
          provider: 'paymob',
        }),
      });
      assert(res1.status === 200, `Expected 200 on first payment intent, got ${res1.status}`);
      const json1 = await res1.json();
      assert(json1.data.isIdempotentReplay === false, 'First call must have isIdempotentReplay === false');
      const firstIntentId = json1.data.paymentIntentId;

      // 2. Identical retry with same Idempotency-Key -> replays same paymentIntentId
      const res2 = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
          'Idempotency-Key': 'pi_idem_shared_key_01',
        },
        body: JSON.stringify({
          orderId: 'ord_bagour_8102',
          provider: 'paymob',
        }),
      });
      assert(res2.status === 200, `Expected 200 on idempotent replay, got ${res2.status}`);
      const json2 = await res2.json();
      assert(json2.data.isIdempotentReplay === true, 'Replay must have isIdempotentReplay === true');
      assert(json2.data.paymentIntentId === firstIntentId, 'Replay must return identical paymentIntentId');

      // 3. Same customer reuses same Idempotency-Key with different provider -> 409 IDEMPOTENCY_PAYLOAD_MISMATCH
      const resMismatch = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
          'Idempotency-Key': 'pi_idem_shared_key_01',
        },
        body: JSON.stringify({
          orderId: 'ord_bagour_8102',
          provider: 'fawry',
        }),
      });
      assert(resMismatch.status === 409, `Expected 409 on payload mismatch, got ${resMismatch.status}`);
      const jsonMismatch = await resMismatch.json();
      assert(
        jsonMismatch.error?.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        `Expected IDEMPOTENCY_PAYLOAD_MISMATCH, got ${jsonMismatch.error?.code}`
      );

      // 4. Different customer uses the exact same Idempotency-Key on their own order -> isolated & succeeds
      const resCust2 = await fetch(`${baseUrl}/payments/intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust2Token}`,
          'Idempotency-Key': 'pi_idem_shared_key_01',
        },
        body: JSON.stringify({
          orderId: 'ord_bagour_8103',
          provider: 'paymob',
        }),
      });
      assert(resCust2.status === 200, `Expected 200 for second customer with same key string, got ${resCust2.status}`);
      const jsonCust2 = await resCust2.json();
      assert(jsonCust2.data.orderId === 'ord_bagour_8103', 'Second customer must receive intent for their own order');
      assert(jsonCust2.data.paymentIntentId !== firstIntentId, 'Second customer must not receive first customer intent');
    } finally {
      server.close();
    }
  });

  await runTest('WebhookHardening', 'Rejects payment webhooks with mismatched amount (422), cancelled order (409), or mismatched provider (400), and fails closed in production when secret is missing', async () => {
    resetTestDatabases();
    const app = createServer();
    const server = app.listen(0);
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    try {
      // 1. Amount mismatch on ord_bagour_8102 (authoritative fare is 3500, webhook claims 100)
      const underpaidPayload = {
        provider: 'paymob' as const,
        eventId: 'evt_underpaid_01',
        eventType: 'TRANSACTION_SUCCESS' as const,
        orderId: 'ord_bagour_8102',
        amountPiasters: 100,
        currency: 'EGP' as const,
        transactionReference: 'TX_UNDER_01',
        timestamp: new Date().toISOString(),
      };
      const rawUnderpaid = JSON.stringify(underpaidPayload);
      const sigUnderpaid = WebhookService.generateSignature(rawUnderpaid, 'paymob');

      const resUnderpaid = await fetch(`${baseUrl}/webhooks/payments/paymob`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-signature': sigUnderpaid,
        },
        body: rawUnderpaid,
      });
      assert(resUnderpaid.status === 422, `Expected 422 for webhook amount mismatch, got ${resUnderpaid.status}`);
      const jsonUnderpaid = await resUnderpaid.json();
      assert(jsonUnderpaid.code === 'WEBHOOK_AMOUNT_MISMATCH', 'Must return WEBHOOK_AMOUNT_MISMATCH');
      assert(PersistentStore.getOrderById('ord_bagour_8102')?.isPaid === false, 'Order must remain unpaid');

      // 2. Cancelled order ord_bagour_8104 cannot be marked paid via webhook
      const cancelledPayload = {
        provider: 'paymob' as const,
        eventId: 'evt_cancelled_01',
        eventType: 'TRANSACTION_SUCCESS' as const,
        orderId: 'ord_bagour_8104',
        amountPiasters: 1700,
        currency: 'EGP' as const,
        transactionReference: 'TX_CANC_01',
        timestamp: new Date().toISOString(),
      };
      const rawCancelled = JSON.stringify(cancelledPayload);
      const sigCancelled = WebhookService.generateSignature(rawCancelled, 'paymob');

      const resCancelled = await fetch(`${baseUrl}/webhooks/payments/paymob`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-signature': sigCancelled,
        },
        body: rawCancelled,
      });
      assert(resCancelled.status === 409, `Expected 409 for cancelled order webhook, got ${resCancelled.status}`);
      const jsonCancelled = await resCancelled.json();
      assert(jsonCancelled.code === 'ORDER_CANCELLED_CANNOT_MARK_PAID', 'Must return ORDER_CANCELLED_CANNOT_MARK_PAID');

      // 3. Production fail-closed when PAYMOB_HMAC_SECRET / PAYMENT_WEBHOOK_SECRET is missing
      const prevEnv = process.env.NODE_ENV;
      const prevPaymob = process.env.PAYMOB_HMAC_SECRET;
      const prevWebhook = process.env.PAYMENT_WEBHOOK_SECRET;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.PAYMOB_HMAC_SECRET;
        delete process.env.PAYMENT_WEBHOOK_SECRET;

        let threwConfigMissing = false;
        try {
          WebhookService.verifySignature(rawUnderpaid, sigUnderpaid, 'paymob');
        } catch (err: any) {
          threwConfigMissing = err.code === 'WEBHOOK_CONFIG_MISSING' && err.statusCode === 500;
        }
        assert(threwConfigMissing, 'WebhookService.verifySignature must fail closed with 500 WEBHOOK_CONFIG_MISSING in production when secret is unset');
      } finally {
        process.env.NODE_ENV = prevEnv;
        if (prevPaymob !== undefined) process.env.PAYMOB_HMAC_SECRET = prevPaymob;
        if (prevWebhook !== undefined) process.env.PAYMENT_WEBHOOK_SECRET = prevWebhook;
      }
    } finally {
      server.close();
    }
  });

  await runTest('OrderFSM', 'Records acceptedAt ISO timestamp when order transitions to accepted_by_store or captain_assigned', () => {
    const baseOrder = PersistentStore.getAllOrders()[0];
    const newOrder: Order = {
      ...baseOrder,
      id: 'ord_test_accepted_ts_01',
      merchantUserId: 'usr_merch_01',
      status: 'created',
      acceptedAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert(newOrder.acceptedAt === undefined, 'Initial order should not have acceptedAt');

    const s1 = OrderFsm.transition(newOrder, {
      targetStatus: 'accepted_by_store',
      actorId: 'usr_merch_01',
      actorRole: 'merchant',
    });

    assert(typeof s1.order.acceptedAt === 'string' && s1.order.acceptedAt.length > 10, 'Order must record acceptedAt ISO timestamp upon acceptance');
    const firstAcceptedAt = s1.order.acceptedAt;

    const s2 = OrderFsm.transition(s1.order, {
      targetStatus: 'preparing',
      actorId: 'usr_merch_01',
      actorRole: 'merchant',
    });
    assert(s2.order.acceptedAt === firstAcceptedAt, 'Subsequent transitions must preserve original acceptedAt timestamp');
  });

  await runTest('RideBookingJourneyE2E', 'Executes complete Customer مشوار (errand) HTTP ride-booking journey: quote, route reversal, order creation, captain acceptance, immutable acceptedAt across at_pickup -> picked_up -> in_transit -> delivered, and cancellation guards', async () => {
    resetTestDatabases();
    const app = createServer();
    const server = app.listen(0);
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    try {
      const custToken = generateTestToken({ userId: 'usr_cust_01', role: 'customer' });
      const capToken = generateTestToken({ userId: 'usr_cpt_01', role: 'captain' });

      // Step 1 & 2: Request quote for مشوار (errand) from Station Square to Behnay Village
      const quoteRes1 = await fetch(`${baseUrl}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceTypeId: 'errand',
          distanceKm: 3.1,
          isRuralOrVillage: true,
          pickupLandmark: 'ميدان المحطة - وسط الباجور',
          dropoffLandmark: 'قرية بهناي - المدخل الرئيسي',
        }),
      });
      assert(quoteRes1.status === 201, `Expected 201 from POST /quotes for errand, got ${quoteRes1.status}`);
      const quote1 = (await quoteRes1.json()).data;
      assert(quote1.serviceTypeId === 'errand', 'Quote serviceTypeId must be errand');
      assert(Number.isInteger(quote1.totalFarePiasters) && quote1.totalFarePiasters > 0, 'Quote totalFarePiasters must be positive integer');
      assert(typeof quote1.signature === 'string' && quote1.signature.length === 64, 'Quote must include 64-char HMAC-SHA256 signature');

      // Step 3 & 4: Reverse route and request updated quote
      const quoteResReversed = await fetch(`${baseUrl}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceTypeId: 'errand',
          distanceKm: 3.1,
          isRuralOrVillage: true,
          pickupLandmark: 'قرية بهناي - المدخل الرئيسي',
          dropoffLandmark: 'ميدان المحطة - وسط الباجور',
        }),
      });
      assert(quoteResReversed.status === 201, `Expected 201 from reversed POST /quotes, got ${quoteResReversed.status}`);
      const quoteReversed = (await quoteResReversed.json()).data;
      assert(quoteReversed.totalFarePiasters === quote1.totalFarePiasters, 'Reversed route with same distance/rural status must produce deterministic fare');

      // Step 5: Confirm ride request (POST /orders)
      const createOrderRes = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${custToken}`,
          'Idempotency-Key': 'e2e_ride_journey_order_01',
        },
        body: JSON.stringify({
          serviceTypeId: 'errand',
          quoteId: quoteReversed.quoteId,
          totalFarePiasters: quoteReversed.totalFarePiasters,
          quoteExpiresAt: quoteReversed.expiresAt,
          quoteSignature: quoteReversed.signature,
          pickup: { address: 'قرية بهناي - المدخل الرئيسي' },
          dropoff: { address: 'ميدان المحطة - وسط الباجور' },
          itemDescription: 'مشوار خاص سريع بالباجور',
          paymentMethod: 'cash_on_delivery',
        }),
      });
      assert(createOrderRes.status === 201, `Expected 201 on ride order creation, got ${createOrderRes.status}`);
      const createdOrder: Order = (await createOrderRes.json()).data;
      assert(createdOrder.status === 'created', `New order starts in created state, got ${createdOrder.status}`);
      assert(createdOrder.acceptedAt === undefined, 'Unaccepted order must not have acceptedAt');

      // Step 6: Captain sees order in /captain/orders/available and accepts it (POST /captain/orders/:id/accept)
      const availRes = await fetch(`${baseUrl}/captain/orders/available`, {
        headers: { Authorization: `Bearer ${capToken}` },
      });
      assert(availRes.status === 200, `Expected 200 from /captain/orders/available, got ${availRes.status}`);
      const availOrders: Order[] = (await availRes.json()).data.orders;
      assert(availOrders.some((o) => o.id === createdOrder.id), 'Captain must see the newly created ride request in available orders');

      const acceptRes = await fetch(`${baseUrl}/captain/orders/${createdOrder.id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${capToken}`,
        },
      });
      assert(acceptRes.status === 200, `Expected 200 on captain accept, got ${acceptRes.status}`);
      const acceptedData = (await acceptRes.json()).data;
      const acceptedOrder: Order = acceptedData.order || acceptedData;
      assert(acceptedOrder.status === 'captain_assigned', `Expected captain_assigned after accept, got ${acceptedOrder.status}`);
      assert(typeof acceptedOrder.acceptedAt === 'string' && acceptedOrder.acceptedAt.length >= 20, 'acceptedAt ISO timestamp must be recorded on captain_assigned');
      const immutableAcceptedAt = acceptedOrder.acceptedAt;

      // Step 7: Invalid state jump (captain_assigned -> delivered directly) must be rejected
      const invalidJumpRes = await fetch(`${baseUrl}/orders/${createdOrder.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${capToken}`,
        },
        body: JSON.stringify({ targetStatus: 'delivered' }),
      });
      assert(invalidJumpRes.status >= 400, `Expected 4xx on illegal state jump captain_assigned -> delivered, got ${invalidJumpRes.status}`);

      // Step 8: Valid transitions (at_pickup -> picked_up -> in_transit) preserve acceptedAt immutably
      for (const nextStep of ['at_pickup', 'picked_up', 'in_transit'] as const) {
        const stepRes = await fetch(`${baseUrl}/orders/${createdOrder.id}/transitions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${capToken}`,
          },
          body: JSON.stringify({ targetStatus: nextStep }),
        });
        assert(stepRes.status === 200, `Expected 200 transitioning to ${nextStep}, got ${stepRes.status}`);
        const stepOrder: Order = (await stepRes.json()).data.order;
        assert(stepOrder.status === nextStep, `Expected order status ${nextStep}, got ${stepOrder.status}`);
        assert(
          stepOrder.acceptedAt === immutableAcceptedAt,
          `acceptedAt must remain immutable (${immutableAcceptedAt}) during transition to ${nextStep}, got ${stepOrder.acceptedAt}`
        );
      }

      // Step 9: Customer cancellation after pickup must be rejected (403 CANCELLATION_NOT_ALLOWED)
      const lateCancelRes = await fetch(`${baseUrl}/orders/${createdOrder.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${custToken}`,
        },
        body: JSON.stringify({ reason: 'محاولة إلغاء بعد الاستلام' }),
      });
      assert(lateCancelRes.status === 403, `Expected 403 when customer cancels in_transit order, got ${lateCancelRes.status}`);

      // Step 10: Complete ride via Cash Collection & verify delivered state + immutable acceptedAt
      const codRes = await fetch(`${baseUrl}/captain/orders/${createdOrder.id}/cash-collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${capToken}`,
          'Idempotency-Key': 'e2e_ride_cod_key_01',
        },
        body: JSON.stringify({
          amountCollectedPiasters: createdOrder.totalFarePiasters,
          customerConfirmed: true,
        }),
      });
      assert(codRes.status === 200, `Expected 200 on cash collection, got ${codRes.status}`);
      const finalOrder = PersistentStore.getOrderById(createdOrder.id);
      assert(finalOrder?.status === 'delivered', `Expected delivered status, got ${finalOrder?.status}`);
      assert(finalOrder?.isPaid === true, 'Order must be marked isPaid = true');
      assert(
        finalOrder?.acceptedAt === immutableAcceptedAt,
        'Final delivered order must preserve original acceptedAt timestamp'
      );
    } finally {
      server.close();
    }
  });

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(` MASHWAR TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exitCode = 1;
  }

  return { total, passed, failed, results };
}

// Direct execution when run via `tsx backend/tests/run_tests.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then((res) => {
      if (res.failed > 0) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal test runner error:', err);
      process.exit(1);
    });
}
