// src/assets/js/transactions/model.js
// Model: Responsible for fetching and returning raw transaction data from blockchains
import { fetchEvmTransactions, fetchSolanaTransactions } from './api.js';

export async function getTransactions(address, chain, year) {
  if (!address) return [];
  if (!chain || chain.toLowerCase() === 'ethereum') {
    const explorers = [
      { name: 'Ethereum', url: 'https://api.etherscan.io/api', apiKey: import.meta.env.VITE_ETHERSCAN_API_KEY, usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: { USDC: 6, USDT: 6 } },
      { name: 'Arbitrum', url: 'https://api.arbiscan.io/api', apiKey: import.meta.env.VITE_ARBISCAN_API_KEY, usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', usdt: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', decimals: { USDC: 6, USDT: 6 } },
    ];
    return await fetchEvmTransactions(address, year, explorers);
  }
  if (chain && chain.toLowerCase() === 'solana') {
    const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY;
    return await fetchSolanaTransactions(address, year, heliusApiKey);
  }
  return [];
} 