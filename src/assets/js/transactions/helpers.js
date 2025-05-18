/**
 * Helper functions for filtering, paginating, and calculating stats on transactions.
 * @module transactionsHelpers
 */
import { parseAmount } from '../utils.js';
import { getHistoricalPrice, getFxRate } from './priceApi.js';

/**
 * Filter and paginate transactions, calculate local value, and update state.
 * @param {Array} allTransactions
 * @param {object} options - { year, chain, currency, hideSmallTx, priceCache, fxCache }
 * @returns {Object} { filtered, totalPages, paginated }
 */
export async function filterAndPaginateTransactions(allTransactions, options) {
  const { year, chain, currency, hideSmallTx, priceCache, fxCache, page, pageSize } = options;
  let filtered = [];
  const localThreshold = 1.0;
  const currencySymbol = currency === 'EUR' ? '€' : '$';
  if (!chain || chain.toLowerCase() === 'ethereum') {
    for (const tx of allTransactions) {
      const txYear = new Date(tx.datetime).getFullYear().toString();
      if (txYear !== year) continue;
      const dateStr = tx.dateISO;
      let amount = 0;
      let localValue = null;
      let isUSDC = false, isUSDT = false;
      if (tx.in && tx.in.amount && (tx.in.amount.includes('USDC') || tx.in.amount.includes('USDT'))) {
        isUSDC = tx.in.amount.includes('USDC');
        isUSDT = tx.in.amount.includes('USDT');
        amount = parseAmount(tx.in.amount);
      } else if (tx.out && tx.out.amount && (tx.out.amount.includes('USDC') || tx.out.amount.includes('USDT'))) {
        isUSDC = tx.out.amount.includes('USDC');
        isUSDT = tx.out.amount.includes('USDT');
        amount = parseAmount(tx.out.amount);
      } else {
        amount = tx.in ? parseAmount(tx.in.amount) : (tx.out ? parseAmount(tx.out.amount) : 0);
      }
      if (isUSDC || isUSDT) {
        if (currency === 'USD') {
          localValue = amount;
          tx.local = `${currencySymbol}${localValue.toFixed(2)}`;
        } else if (currency === 'EUR') {
          const fxRate = await getFxRate('USD', 'EUR', fxCache);
          if (fxRate) {
            localValue = amount * fxRate;
            tx.local = `${currencySymbol}${localValue.toFixed(2)}`;
          } else {
            tx.local = '—';
          }
        }
      } else if (dateStr && amount) {
        const price = await getHistoricalPrice('eth', dateStr, currency, priceCache, fxCache);
        localValue = price ? amount * price : null;
        tx.local = price ? `${currencySymbol}${localValue.toFixed(2)}` : '—';
      } else {
        tx.local = '—';
      }
      if (hideSmallTx && (localValue === null || localValue < localThreshold)) continue;
      filtered.push(tx);
    }
  } else if (chain && chain.toLowerCase() === 'solana') {
    for (const tx of allTransactions) {
      const txDate = tx.datetime ? new Date(tx.datetime) : null;
      if (!txDate || txDate.getFullYear().toString() !== year) continue;
      const dateStr = tx.dateISO;
      const amount = tx.in ? parseAmount(tx.in.amount) : (tx.out ? parseAmount(tx.out.amount) : 0);
      let localValue = null;
      if (dateStr && amount) {
        const price = await getHistoricalPrice('sol', dateStr, currency, priceCache, fxCache);
        localValue = price ? amount * price : null;
        tx.local = price ? `${currencySymbol}${localValue.toFixed(2)}` : '—';
      } else {
        tx.local = '—';
      }
      if (hideSmallTx && (localValue === null || localValue < localThreshold)) continue;
      filtered.push(tx);
    }
  }
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const paginated = filtered.slice(start, end);
  return { filtered, totalPages, paginated };
}

/**
 * Calculate total invested (incoming from external wallets).
 * @param {Array} filteredTransactions
 * @param {Array} ownWallets
 * @returns {number}
 */
export function invested(filteredTransactions, ownWallets) {
  let sum = 0;
  const treatAllAsExternal = !ownWallets || ownWallets.length === 0;
  for (const tx of filteredTransactions) {
    if (tx.in && tx.in.wallet && tx.in.wallet.length > 0) {
      let from = (tx.in.walletFull || tx.in.wallet).toLowerCase();
      if (treatAllAsExternal || !ownWallets.includes(from)) {
        let amt = parseFloat(tx.local && tx.local !== '—' ? tx.local.replace(/[^0-9.\-]/g, '') : '0');
        sum += isNaN(amt) ? 0 : amt;
      }
    }
  }
  return sum;
}

/**
 * Calculate total cashed out (outgoing to external wallets).
 * @param {Array} filteredTransactions
 * @param {Array} ownWallets
 * @returns {number}
 */
export function cashedOut(filteredTransactions, ownWallets) {
  let sum = 0;
  const treatAllAsExternal = !ownWallets || ownWallets.length === 0;
  for (const tx of filteredTransactions) {
    if (tx.out && tx.out.wallet && tx.out.wallet.length > 0) {
      let to = (tx.out.walletFull || tx.out.wallet).toLowerCase();
      if (treatAllAsExternal || !ownWallets.includes(to)) {
        let amt = parseFloat(tx.local && tx.local !== '—' ? tx.local.replace(/[^0-9.\-]/g, '') : '0');
        sum += isNaN(amt) ? 0 : amt;
      }
    }
  }
  return sum;
}

/**
 * Get the local currency symbol for display.
 * @param {Array} filteredTransactions
 * @returns {string}
 */
export function localSymbol(filteredTransactions) {
  for (const tx of filteredTransactions) {
    if (tx.local && tx.local !== '—') {
      const match = tx.local.match(/^[^0-9.\-]+/);
      return match ? match[0] : '$';
    }
  }
  return '$';
} 