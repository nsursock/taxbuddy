// src/assets/js/transactions/controller.js
// Controller: Handles filtering, pagination, and stat calculations for transactions
import { filterAndPaginateTransactions, invested, cashedOut, localSymbol } from './helpers.js';
import { getTransactions } from './model.js';

export async function getFilteredPaginatedTransactions({ address, chain, year, currency, hideSmallTx, page, pageSize, priceCache, fxCache }) {
  const allTransactions = await getTransactions(address, chain, year);
  return await filterAndPaginateTransactions(allTransactions, {
    year,
    chain,
    currency,
    hideSmallTx,
    priceCache,
    fxCache,
    page,
    pageSize,
  });
}

export { invested, cashedOut, localSymbol }; 