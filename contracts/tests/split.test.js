import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePaymentSplit,
  EXEC_RESERVE_NANOTON,
  getEstimatedForwardFeeNanoton
} from '../../backend/src/config/tonConfig.js';

describe('computePaymentSplit (v3 router)', () => {
  it('first payment: deducts execution reserve and two forward fees before 50/50 split', () => {
    const gross = 100_000_000n;
    const split = computePaymentSplit(gross, { commissionEligible: true });
    const fwd = getEstimatedForwardFeeNanoton();
    assert.equal(split.grossNanoton, gross);
    assert.equal(split.executionReserveNanoton, EXEC_RESERVE_NANOTON);
    assert.equal(split.outgoingFeesNanoton, fwd * 2n);
    assert.equal(split.outboundMessageCount, 2);
    assert.equal(
      split.referrerShareNanoton + split.treasuryShareNanoton,
      split.distributableNanoton
    );
    assert.equal(split.referrerShareNanoton, split.distributableNanoton / 2n);
  });

  it('assigns odd nanoton remainder to treasury on 50/50', () => {
    const gross = 101_000_000n;
    const split = computePaymentSplit(gross, { commissionEligible: true });
    assert.equal(split.referrerShareNanoton, split.distributableNanoton / 2n);
    assert.equal(
      split.treasuryShareNanoton,
      split.distributableNanoton - split.referrerShareNanoton
    );
    // When distributable is odd, treasury > referrer
    if (split.distributableNanoton % 2n === 1n) {
      assert.ok(split.treasuryShareNanoton > split.referrerShareNanoton);
    }
  });

  it('renewal / no-referrer: commission 0, single outbound fee, full net to treasury', () => {
    const gross = 100_000_000n;
    const split = computePaymentSplit(gross, { commissionEligible: false });
    const fwd = getEstimatedForwardFeeNanoton();
    assert.equal(split.referrerShareNanoton, 0n);
    assert.equal(split.commissionNanoton, 0n);
    assert.equal(split.treasuryShareNanoton, split.distributableNanoton);
    assert.equal(split.outgoingFeesNanoton, fwd * 1n);
    assert.equal(split.outboundMessageCount, 1);
  });

  it('never overspends — shares plus fees equal gross', () => {
    for (const eligible of [true, false]) {
      const gross = 250_000_000n;
      const split = computePaymentSplit(gross, { commissionEligible: eligible });
      assert.equal(
        split.referrerShareNanoton +
          split.treasuryShareNanoton +
          split.executionReserveNanoton +
          split.outgoingFeesNanoton,
        split.grossNanoton
      );
    }
  });

  it('fails safe when gross does not exceed estimated fees', () => {
    assert.throws(
      () => computePaymentSplit(5_000_000n, { commissionEligible: true }),
      /Gross amount must exceed estimated execution and forward fees/
    );
  });
});
