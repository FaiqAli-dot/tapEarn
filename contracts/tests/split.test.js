import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePaymentSplit,
  EXEC_RESERVE_NANOTON,
  getEstimatedForwardFeeNanoton
} from '../../backend/src/config/tonConfig.js';

describe('computePaymentSplit (v2 router)', () => {
  it('deducts execution reserve and two forward fees before 50/50 split', () => {
    const gross = 100_000_000n;
    const split = computePaymentSplit(gross);
    const fwd = getEstimatedForwardFeeNanoton();
    assert.equal(split.grossNanoton, gross);
    assert.equal(split.executionReserveNanoton, EXEC_RESERVE_NANOTON);
    assert.equal(split.outgoingFeesNanoton, fwd * 2n);
    assert.equal(
      split.referrerShareNanoton + split.treasuryShareNanoton,
      split.distributableNanoton
    );
    assert.equal(split.referrerShareNanoton, split.distributableNanoton / 2n);
  });

  it('assigns odd nanoton remainder to treasury', () => {
    const gross = 101_000_000n;
    const split = computePaymentSplit(gross);
    assert.equal(split.referrerShareNanoton, split.distributableNanoton / 2n);
    assert.equal(
      split.treasuryShareNanoton,
      split.distributableNanoton - split.referrerShareNanoton
    );
  });

  it('never overspends — shares plus fees equal gross', () => {
    const gross = 250_000_000n;
    const split = computePaymentSplit(gross);
    assert.equal(
      split.referrerShareNanoton +
        split.treasuryShareNanoton +
        split.executionReserveNanoton +
        split.outgoingFeesNanoton,
      split.grossNanoton
    );
  });

  it('fails safe when gross does not exceed estimated fees', () => {
    assert.throws(
      () => computePaymentSplit(5_000_000n),
      /Gross amount must exceed estimated execution and forward fees/
    );
  });
});
