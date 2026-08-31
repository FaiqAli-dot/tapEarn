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

/**
 * Best-effort verification of inbound payment to contract/treasury.
 * Returns { found: boolean, valueNanoton?: bigint, fromAddress?: string }
 */
export async function verifyInboundTonPayment(params) {
  if (process.env.TON_CHAIN_MOCK === 'true' && String(params.txHash).startsWith('mock-')) {
    return {
      found: true,
      valueNanoton: String(params.minValueNanoton),
      fromAddress: params.expectedSender,
      txHash: params.txHash
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

  if (!txHash) {
    return { found: false, reason: 'missing_tx_hash' };
  }

  try {
    const txs = await getAddressTransactions(expectedRecipient, 20);
    const list = Array.isArray(txs) ? txs : [txs].filter(Boolean);

    for (const tx of list) {
      const hash = tx.transaction_id?.hash || tx.hash;
      if (hash !== txHash) continue;

      const inMsg = tx.in_msg;
      const value = BigInt(inMsg?.value || 0);
      const source = inMsg?.source || '';

      if (value < BigInt(minValueNanoton)) {
        return { found: false, reason: 'insufficient_value', valueNanoton: value.toString() };
      }

      if (expectedSender && source && source !== expectedSender) {
        return { found: false, reason: 'wrong_sender', source };
      }

      return {
        found: true,
        valueNanoton: value.toString(),
        fromAddress: source,
        txHash: hash
      };
    }

    return { found: false, reason: 'tx_not_found_for_recipient' };
  } catch (error) {
    return { found: false, reason: error.message };
  }
}

/**
 * Verify outbound payout from contract/treasury to destination wallet.
 */
export async function verifyOutboundTonPayout(params) {
  if (process.env.TON_CHAIN_MOCK === 'true' && String(params.txHash).startsWith('mock-')) {
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
  minValueNanoton
}) {
  assertTestnetOnly('testnet');

  if (!txHash) {
    return { found: false, reason: 'missing_tx_hash' };
  }

  try {
    const txs = await getAddressTransactions(expectedSender, 20);
    const list = Array.isArray(txs) ? txs : [txs].filter(Boolean);

    for (const tx of list) {
      const hash = tx.transaction_id?.hash || tx.hash;
      if (hash !== txHash) continue;

      const outMsgs = tx.out_msgs || [];
      for (const out of outMsgs) {
        const dest = out.destination || '';
        const value = BigInt(out.value || 0);
        if (dest === expectedRecipient && value >= BigInt(minValueNanoton)) {
          return {
            found: true,
            valueNanoton: value.toString(),
            toAddress: dest,
            txHash: hash
          };
        }
      }
    }

    return { found: false, reason: 'payout_not_found' };
  } catch (error) {
    return { found: false, reason: error.message };
  }
}

export function getTestnetExplorerTxUrl(txHash) {
  return `https://testnet.tonscan.org/tx/${txHash}`;
}

export function getTestnetExplorerAddressUrl(address) {
  return `https://testnet.tonscan.org/address/${address}`;
}
