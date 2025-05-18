/**
 * Alpine component for fetching and displaying EVM/Solana transactions in the dashboard.
 * Modularized for clarity and maintainability.
 *
 * @module transactionsTable
 */
import { fetchEvmTransactions, fetchSolanaTransactions } from './api.js';
import { filterAndPaginateTransactions, invested, cashedOut, localSymbol } from './helpers.js';

/**
 * Register the transactionsTable Alpine component globally.
 */
export function registerTransactionsTable() {
  window.transactionsTable = (address, chain, year = '2024') => ({
    address,
    chain,
    year,
    currency: 'USD',
    hideSmallTx: true,
    lastFetch: { address: null, chain: null, year: null },
    page: 1,
    pageSize: 10,
    totalPages: 1,
    allTransactions: [],
    transactions: [],
    filteredTransactions: [],
    loading: false,
    priceCache: {},
    fxCache: {},

    /**
     * Fetch and update transactions from blockchain APIs.
     */
    async fetchTransactions() {
      if (
        this.lastFetch.address === this.address &&
        this.lastFetch.chain === this.chain &&
        this.lastFetch.year === this.year
      ) {
        return;
      }
      this.lastFetch = {
        address: this.address,
        chain: this.chain,
        year: this.year
      };
      if (!this.address) return;
      this.loading = true;
      this.transactions = [];
      this.allTransactions = [];
      let loadingToast = null;
      if (this.$store && this.$store.notyf) {
        loadingToast = this.$store.notyf.info('Loading transactions...', { duration: 0 });
      }
      // EVM chains
      if (!this.chain || this.chain.toLowerCase() === 'ethereum') {
        const explorers = [
          { name: 'Ethereum', url: 'https://api.etherscan.io/api', apiKey: import.meta.env.VITE_ETHERSCAN_API_KEY, usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: { USDC: 6, USDT: 6 } },
          { name: 'Arbitrum', url: 'https://api.arbiscan.io/api', apiKey: import.meta.env.VITE_ARBISCAN_API_KEY, usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', usdt: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', decimals: { USDC: 6, USDT: 6 } },
        ];
        this.allTransactions = await fetchEvmTransactions(this.address, this.year, explorers);
      }
      // Solana
      if (this.chain && this.chain.toLowerCase() === 'solana') {
        try {
          const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY;
          this.allTransactions = await fetchSolanaTransactions(this.address, this.year, heliusApiKey);
        } catch (e) {
          // Error already logged in API
        }
      }
      await this.updateTransactions();
      this.loading = false;
      if (loadingToast && this.$store && this.$store.notyf && this.$store.notyf.dismiss) {
        this.$store.notyf.dismiss(loadingToast);
      }
      if (this.$store && this.$store.notyf) {
        this.$store.notyf.success('Transactions loaded!');
      }
    },

    /**
     * Filter and paginate transactions, calculate local value, and update state.
     */
    async updateTransactions() {
      const { filtered, totalPages, paginated } = await filterAndPaginateTransactions(
        this.allTransactions,
        {
          year: this.year,
          chain: this.chain,
          currency: this.currency,
          hideSmallTx: this.hideSmallTx,
          priceCache: this.priceCache,
          fxCache: this.fxCache,
          page: this.page,
          pageSize: this.pageSize,
        }
      );
      this.filteredTransactions = filtered;
      this.totalPages = totalPages;
      this.transactions = paginated;
    },

    // Watchers for page, year, and allTransactions
    get watchPage() { this.updateTransactions(); return this.page; },
    get watchYear() { this.updateTransactions(); return this.year; },
    get watchAllTransactions() { this.updateTransactions(); return this.allTransactions; },

    /**
     * Calculate which pages to show in pagination.
     * @returns {Array}
     */
    pagesToShow() {
      const max = 10;
      const pages = [];
      if (this.totalPages <= max) {
        for (let i = 1; i <= this.totalPages; i++) pages.push(i);
      } else {
        const firstPage = 1;
        const lastPage = this.totalPages;
        let start = Math.max(this.page - Math.floor((max - 2) / 2), 2);
        let end = start + max - 3;
        if (end >= lastPage) {
          end = lastPage - 1;
          start = end - (max - 3);
        }
        if (start < 2) start = 2;
        pages.push(firstPage);
        if (start > 2) {
          pages.push('...');
        }
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
        if (end < lastPage - 1) {
          pages.push('...');
        }
        pages.push(lastPage);
      }
      return pages;
    },

    /**
     * Calculate total invested (incoming from external wallets).
     * @returns {number}
     */
    invested() {
      return invested(this.filteredTransactions, this.$store.ownWallets);
    },

    /**
     * Calculate total cashed out (outgoing to external wallets).
     * @returns {number}
     */
    cashedOut() {
      return cashedOut(this.filteredTransactions, this.$store.ownWallets);
    },

    /**
     * Get the local currency symbol for display.
     * @returns {string}
     */
    localSymbol() {
      return localSymbol(this.filteredTransactions);
    },
  });
} 