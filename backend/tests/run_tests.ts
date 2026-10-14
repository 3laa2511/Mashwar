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
import { Order, CaptainProfile, WebhookEventPayload } from '../src/types/index.js';

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
  // SUMMARY
  // --------------------------------------------------------------------------
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
