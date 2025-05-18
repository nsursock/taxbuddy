/**
 * API functions for fetching blockchain transactions (EVM, Solana).
 * @module transactionsApi
 */

/**
 * Fetch EVM (Ethereum, Arbitrum, etc.) transactions for an address and year.
 * @param {string} address
 * @param {string} year
 * @param {Array} explorers - List of explorer configs
 * @returns {Promise<Array>} Normalized transactions
 */
export async function fetchEvmTransactions(address, year, explorers) {
  const allTxs = [];
  for (const explorer of explorers) {
    // Native ETH
    try {
      const resp = await fetch(`${explorer.url}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${explorer.apiKey}`);
      const data = await resp.json();
      if (data.status === '1') {
        const txs = data.result
          .filter(tx => new Date(tx.timeStamp * 1000).getFullYear().toString() === year)
          .map(tx => ({
            type: tx.to && tx.to.toLowerCase() === address.toLowerCase() ? 'in' : 'out',
            datetime: new Date(tx.timeStamp * 1000).toLocaleString(),
            dateISO: new Date(tx.timeStamp * 1000).toISOString().slice(0, 10),
            out: tx.to && tx.to.toLowerCase() !== address.toLowerCase() ? { amount: `${(parseFloat(tx.value) / 1e18).toFixed(4)} ETH`, wallet: tx.to.slice(0, 6) + '...' + tx.to.slice(-4) } : null,
            in: tx.to && tx.to.toLowerCase() === address.toLowerCase() ? { amount: `${(parseFloat(tx.value) / 1e18).toFixed(4)} ETH`, wallet: tx.from.slice(0, 6) + '...' + tx.from.slice(-4) } : null,
            local: '—',
            hash: tx.hash,
          }));
        allTxs.push(...txs);
      }
      // ERC20 (USDC/USDT)
      const tokenResp = await fetch(`${explorer.url}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${explorer.apiKey}`);
      const tokenData = await tokenResp.json();
      if (tokenData.status === '1') {
        const usdcAddr = explorer.usdc.toLowerCase();
        const usdtAddr = explorer.usdt.toLowerCase();
        const tokenTxs = tokenData.result
          .filter(tx => {
            const txYear = new Date(tx.timeStamp * 1000).getFullYear().toString();
            const tokenAddr = tx.contractAddress.toLowerCase();
            return txYear === year && (tokenAddr === usdcAddr || tokenAddr === usdtAddr);
          })
          .map(tx => {
            const tokenAddr = tx.contractAddress.toLowerCase();
            const symbol = tokenAddr === usdcAddr ? 'USDC' : 'USDT';
            const decimals = explorer.decimals[symbol];
            const amount = (parseFloat(tx.value) / Math.pow(10, decimals)).toFixed(2);
            const isIn = tx.to && tx.to.toLowerCase() === address.toLowerCase();
            const isOut = tx.from && tx.from.toLowerCase() === address.toLowerCase();
            return {
              type: isIn ? 'in' : (isOut ? 'out' : 'other'),
              datetime: new Date(tx.timeStamp * 1000).toLocaleString(),
              dateISO: new Date(tx.timeStamp * 1000).toISOString().slice(0, 10),
              out: isOut ? { amount: `${amount} ${symbol}`, wallet: tx.to.slice(0, 6) + '...' + tx.to.slice(-4) } : null,
              in: isIn ? { amount: `${amount} ${symbol}`, wallet: tx.from.slice(0, 6) + '...' + tx.from.slice(-4) } : null,
              local: '—',
              hash: tx.hash,
            };
          });
        allTxs.push(...tokenTxs);
      }
    } catch (e) {
      console.error(`Error fetching from ${explorer.name}:`, e);
    }
  }
  return allTxs;
}

/**
 * Fetch Solana transactions for an address and year using Helius API.
 * @param {string} address
 * @param {string} year
 * @param {string} heliusApiKey
 * @returns {Promise<Array>} Normalized transactions
 */
export async function fetchSolanaTransactions(address, year, heliusApiKey) {
  try {
    const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${heliusApiKey}&limit=100`;
    const txListResp = await fetch(url);
    if (!txListResp.ok) {
      let errorMsg = `Helius API returned error: ${txListResp.status} ${txListResp.statusText}`;
      try {
        const errorBody = await txListResp.json();
        if (errorBody && errorBody.error) {
          errorMsg += ` - ${errorBody.error}`;
        } else if (errorBody && errorBody.message) {
          errorMsg += ` - ${errorBody.message}`;
        }
      } catch (e) {}
      throw new Error(errorMsg);
    }
    const txList = await txListResp.json();
    return Array.isArray(txList) ? txList.map(tx => {
      const txDate = tx.timestamp ? new Date(tx.timestamp * 1000) : null;
      let type = 'other';
      let out = null;
      let inTx = null;
      let local = '—';
      const shorten = addr => addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';
      if (Array.isArray(tx.nativeTransfers)) {
        const transfer = tx.nativeTransfers.find(t => t.fromUserAccount === address || t.toUserAccount === address);
        if (transfer) {
          if (transfer.fromUserAccount === address) {
            type = 'out';
            out = { amount: `${(transfer.amount / 1e9).toFixed(4)} SOL`, wallet: shorten(transfer.toUserAccount) };
          } else if (transfer.toUserAccount === address) {
            type = 'in';
            inTx = { amount: `${(transfer.amount / 1e9).toFixed(4)} SOL`, wallet: shorten(transfer.fromUserAccount) };
          }
        }
      }
      return {
        type,
        datetime: txDate ? txDate.toLocaleString() : '',
        dateISO: txDate ? txDate.toISOString().slice(0, 10) : '',
        out,
        in: inTx,
        local,
        hash: tx.signature,
      };
    }) : [];
  } catch (e) {
    console.error('Error fetching from Helius:', e);
    throw e;
  }
} 