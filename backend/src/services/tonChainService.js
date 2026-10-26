import {
  assertTestnetOnly,
  getTestnetRpcBase,
  getTonApiKey
} from '../config/tonConfig.js';

function rpcHeaders() {
  const key = getTonApiKey();
  return key ? { 'X-API-Key': key } : {};
}

async function toncenterGet(path, params = {}) {
  const base = getTestnetRpcBase();
  const url = new URL(`${base}/${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url, { headers: rpcHeaders() });
  if (!res.ok) {
    throw new Error(`TON RPC error ${res.status}: ${path}`);
  }
  const json = await res.json();
  if (!json.ok && json.ok !== undefined) {
    throw new Error(json.error || `TON RPC failed: ${path}`);
  }
  return json.result ?? json;
}

export async function getTransactionByHash(txHash) {
  assertTestnetOnly('testnet');
  return toncenterGet('getTransactions', {
    hash: txHash,
    limit: 1
  });
}

export async function getAddressTransactions(address, limit = 10) {
  assertTestnetOnly('testnet');
  return toncenterGet('getTransactions', {
    address,
    limit
  });
}

function normalizeAddress(addr) {
  if (!addr) return '';
  return String(addr).trim();
}

function addressesMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  // Compare raw forms when both parseable — soft match on suffix (workchain+hash hex)
  const strip = (x) => String(x).replace(/^EQ|^UQ|^0Q|^kQ/, '');
  return strip(a) === strip(b);
}

function txHashOf(tx) {
  return tx?.transaction_id?.hash || tx?.hash || null;
}

function valueOfInMsg(tx) {
  return BigInt(tx?.in_msg?.value || 0);
}

function sourceOfInMsg(tx) {
  return tx?.in_msg?.source || '';
}

/**
 * Best-effort verification of inbound payment to contract/treasury.
 * Returns { found: boolean, valueNanoton?: string, fromAddress?: string, txHash?: string, outMsgs?: [] }
 */
export async function verifyInboundTonPayment(params) {
  if (process.env.TON_CHAIN_MOCK === 'true' && String(params.txHash || '').startsWith('mock-')) {
    return {
      found: true,
      valueNanoton: String(params.minValueNanoton),
      fromAddress: params.expectedSender,
      txHash: params.txHash,
      outMsgs: params.mockOutMsgs || []
    };
  }
  return verifyInboundTonPaymentOnChain(params);
}

async function verifyInboundTonPaymentOnChain({
  txHash,
  expectedRecipient,
  expectedSender,
  minValueNanoton
}) {
  assertTestnetOnly('testnet');

  if (!txHash && !expectedSender) {
    return { found: false, reason: 'missing_tx_hash' };
  }

  try {
    const txs = await getAddressTransactions(expectedRecipient, 30);
    const list = Array.isArray(txs) ? txs : [txs].filter(Boolean);

    for (const tx of list) {
      const hash = txHashOf(tx);
      if (txHash && hash !== txHash) continue;

      const value = valueOfInMsg(tx);
      const source = sourceOfInMsg(tx);

      if (value < BigInt(minValueNanoton)) {
        if (txHash) {
          return { found: false, reason: 'insufficient_value', valueNanoton: value.toString() };
        }
        continue;
      }

      if (expectedSender && source && !addressesMatch(source, expectedSender)) {
        if (txHash) {
          return { found: false, reason: 'wrong_sender', source };
        }
        continue;
      }

      return {
        found: true,
        valueNanoton: value.toString(),
        fromAddress: source,
        txHash: hash,
        outMsgs: tx.out_msgs || [],
        computeExitCode: tx.compute_exit_code ?? tx.description?.compute_ph?.exit_code,
        aborted: Boolean(tx.aborted)
      };
    }

    return { found: false, reason: 'tx_not_found_for_recipient' };
  } catch (error) {
    return { found: false, reason: error.message };
  }
}

/**
 * Verify outbound payout from contract/treasury to destination wallet.
 * On TON, outs are typically on the same contract transaction as the inbound.
 */
export async function verifyOutboundTonPayout(params) {
  if (process.env.TON_CHAIN_MOCK === 'true' && String(params.txHash || '').startsWith('mock-')) {
    if (String(params.txHash).startsWith('mock-fail-')) {
      return { found: false, reason: 'mock_forced_failure' };
    }
    return {
      found: true,
      valueNanoton: String(params.minValueNanoton),
      toAddress: params.expectedRecipient,
      txHash: params.txHash
    };
  }
  return verifyOutboundTonPayoutOnChain(params);
}

async function verifyOutboundTonPayoutOnChain({
  txHash,
  expectedSender,
  expectedRecipient,
  minValueNanoton,
  outMsgs
}) {
  assertTestnetOnly('testnet');

  if (!txHash && !outMsgs) {
    return { found: false, reason: 'missing_tx_hash' };
  }

  try {
    let messages = outMsgs;
    if (!messages) {
      const txs = await getAddressTransactions(expectedSender, 30);
      const list = Array.isArray(txs) ? txs : [txs].filter(Boolean);
      const match = list.find((tx) => txHashOf(tx) === txHash);
      if (!match) {
        return { found: false, reason: 'payout_tx_not_found' };
      }
      messages = match.out_msgs || [];
    }

    for (const out of messages) {
      const dest = normalizeAddress(out.destination || '');
      const value = BigInt(out.value || 0);
      const bounced = Boolean(out.bounced);
      if (bounced) continue;
      if (addressesMatch(dest, expectedRecipient) && value >= BigInt(minValueNanoton)) {
        return {
          found: true,
          valueNanoton: value.toString(),
          toAddress: dest,
          txHash
        };
      }
    }

    return { found: false, reason: 'payout_not_found' };
  } catch (error) {
    return { found: false, reason: error.message };
  }
}

/**
 * Discover the contract transaction for a payment without trusting a client hash.
 * Matches recent inbound txs by sender + min value (and optional exact value).
 * TON Connect returns a BOC, not a chain tx hash — callers should pass bocHint as a marker
 * and let discovery find the real hash.
 */
export async function discoverContractPaymentTx({
  contractAddress,
  expectedSender,
  minValueNanoton,
  exactValueNanoton,
  knownTxHash
}) {
  if (process.env.TON_CHAIN_MOCK === 'true') {
    // Only invent a mock discovery when a BOC was submitted (no real hash yet)
    // or when a mock-* hash was already known. Never invent from thin air.
    if (knownTxHash && String(knownTxHash).startsWith('mock-fail-')) {
      return { found: false, reason: 'mock_forced_failure' };
    }
    const hash =
      knownTxHash && String(knownTxHash).startsWith('mock-')
        ? knownTxHash
        : `mock-discovered-${Date.now()}`;
    return {
      found: true,
      txHash: hash,
      valueNanoton: String(exactValueNanoton || minValueNanoton),
      fromAddress: expectedSender,
      outMsgs: [],
      mocked: true
    };
  }

  assertTestnetOnly('testnet');

  if (knownTxHash && !String(knownTxHash).startsWith('te6') && knownTxHash.length < 200) {
    const direct = await verifyInboundTonPaymentOnChain({
      txHash: knownTxHash,
      expectedRecipient: contractAddress,
      expectedSender,
      minValueNanoton
    });
    if (direct.found) return direct;
  }

  try {
    const txs = await getAddressTransactions(contractAddress, 40);
    const list = Array.isArray(txs) ? txs : [txs].filter(Boolean);
    const minVal = BigInt(minValueNanoton);
    const exact = exactValueNanoton != null ? BigInt(exactValueNanoton) : null;

    for (const tx of list) {
      const value = valueOfInMsg(tx);
      const source = sourceOfInMsg(tx);
      if (expectedSender && source && !addressesMatch(source, expectedSender)) continue;
      if (exact != null) {
        if (value !== exact) continue;
      } else if (value < minVal) {
        continue;
      }

      return {
        found: true,
        txHash: txHashOf(tx),
        valueNanoton: value.toString(),
        fromAddress: source,
        outMsgs: tx.out_msgs || [],
        computeExitCode: tx.compute_exit_code,
        aborted: Boolean(tx.aborted)
      };
    }

    return { found: false, reason: 'no_matching_contract_tx' };
  } catch (error) {
    return { found: false, reason: error.message };
  }
}

/**
 * Inspect out_msgs on a contract payment tx for referrer / treasury legs.
 * A bounced or missing leg → partial settlement (never treat as fully settled).
 */
export function inspectPayoutLegs({
  outMsgs = [],
  referrerWallet,
  treasuryWallet,
  referrerShareNanoton,
  treasuryShareNanoton
}) {
  const legs = { referrer: null, treasury: null, bouncedCount: 0 };

  for (const out of outMsgs) {
    const dest = normalizeAddress(out.destination || '');
    const value = BigInt(out.value || 0);
    if (out.bounced) {
      legs.bouncedCount += 1;
      continue;
    }
    if (
      referrerWallet &&
      addressesMatch(dest, referrerWallet) &&
      value >= BigInt(referrerShareNanoton || 0)
    ) {
      legs.referrer = { dest, valueNanoton: value.toString() };
    }
    if (treasuryWallet && addressesMatch(dest, treasuryWallet) && value >= BigInt(treasuryShareNanoton || 0)) {
      legs.treasury = { dest, valueNanoton: value.toString() };
    }
  }

  return legs;
}

export function getTestnetExplorerTxUrl(txHash) {
  return `https://testnet.tonscan.org/tx/${encodeURIComponent(txHash)}`;
}

export function getTestnetExplorerAddressUrl(address) {
  return `https://testnet.tonscan.org/address/${address}`;
}

/** True if the client submitted a BOC blob instead of a transaction hash. */
export function looksLikeBocNotHash(value) {
  if (!value) return false;
  const s = String(value);
  if (s.startsWith('te6') || s.startsWith('te6c')) return true;
  if (s.length > 120 && /^[A-Za-z0-9+/=]+$/.test(s)) return true;
  return false;
}
