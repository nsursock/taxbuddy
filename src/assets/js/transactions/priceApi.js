/**
 * API functions for fetching historical crypto prices and FX rates.
 * @module priceApi
 */

/**
 * Fetch historical price for a symbol (ETH/SOL) on a given date and currency.
 * Uses Binance and Frankfurter APIs. Caches results in priceCache/fxCache.
 * @param {string} symbol - 'eth' or 'sol'
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} currency - 'USD' or 'EUR'
 * @param {object} priceCache
 * @param {object} fxCache
 * @returns {Promise<number|null>}
 */
export async function getHistoricalPrice(symbol, dateStr, currency, priceCache, fxCache) {
  const cacheKey = `${symbol}-${dateStr}-${currency}`;
  if (priceCache[cacheKey]) return priceCache[cacheKey];
  const pair = symbol === 'eth' ? 'ETHUSDT' : symbol === 'sol' ? 'SOLUSDT' : null;
  if (!pair) return null;
  const date = new Date(dateStr + 'T00:00:00Z');
  const startTime = date.getTime();
  const endTime = startTime + 24 * 60 * 60 * 1000;
  let usdPrice = null;
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&startTime=${startTime}&endTime=${endTime}&limit=1`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      usdPrice = parseFloat(data[0][4]);
    }
  } catch (e) {
    return null;
  }
  if (!usdPrice) return null;
  if (currency === 'USD') {
    priceCache[cacheKey] = usdPrice;
    return usdPrice;
  }
  if (currency === 'EUR') {
    const fxRate = await getFxRate('USD', 'EUR', fxCache);
    if (fxRate) {
      const eurPrice = usdPrice * fxRate;
      priceCache[cacheKey] = eurPrice;
      return eurPrice;
    } else {
      return null;
    }
  }
  return null;
}

/**
 * Fetch latest FX rate from one currency to another. Uses Frankfurter API and caches result.
 * @param {string} from
 * @param {string} to
 * @param {object} fxCache
 * @returns {Promise<number|null>}
 */
export async function getFxRate(from, to, fxCache) {
  const fxKey = `latest-${from}-${to}`;
  if (fxCache[fxKey]) return fxCache[fxKey];
  try {
    const fxResp = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const fxData = await fxResp.json();
    if (fxData && fxData.rates && fxData.rates[to]) {
      fxCache[fxKey] = fxData.rates[to];
      return fxData.rates[to];
    }
  } catch (e) {
    return null;
  }
  return null;
} 