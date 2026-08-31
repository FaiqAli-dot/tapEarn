import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePaymentSplit, FEE_RESERVE_NANOTON } from '../../backend/src/config/tonConfig.js';

describe('computePaymentSplit', () => {
  it('deducts fee reserve before 50/50 split', () => {
    const gross = 100_000_000n; // 0.1 TON
    const split = computePaymentSplit(gross);
    assert.equal(split.grossNanoton, gross);
    assert.equal(split.feeReserveNanoton, FEE_RESERVE_NANOTON);
    assert.equal(split.netNanoton, gross - FEE_RESERVE_NANOTON);
    assert.equal(
      split.referrerShareNanoton + split.treasuryShareNanoton,
      split.netNanoton
    );
    assert.equal(split.referrerShareNanoton, split.netNanoton / 2n);
  });

  it('assigns odd nanoton remainder to treasury', () => {
    const gross = 101_000_000n;
    const split = computePaymentSplit(gross);
    assert.equal(split.referrerShareNanoton, split.netNanoton / 2n);
    assert.equal(
      split.treasuryShareNanoton,
      split.netNanoton - split.referrerShareNanoton
    );
  });

  it('never overspends — shares plus fees equal gross', () => {
    const gross = 250_000_000n;
    const split = computePaymentSplit(gross);
    assert.equal(
      split.referrerShareNanoton + split.treasuryShareNanoton + split.feeReserveNanoton,
      split.grossNanoton
    );
  });

  it('fails safe when gross does not exceed fee reserve', () => {
    assert.throws(() => computePaymentSplit(10_000_000n), /Gross amount must exceed fee reserve/);
  });
});
