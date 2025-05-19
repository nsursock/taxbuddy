/**
 * Alpine component for fetching and displaying EVM/Solana transactions in the dashboard.
 * Modularized for clarity and maintainability.
 *
 * @module transactionsTable
 */
import { getFilteredPaginatedTransactions, invested, cashedOut, localSymbol } from './controller.js';

/**
 * Register the transactionsTable Alpine component globally.
 */
export function registerTransactionsTable() {
  window.transactionsTable = (address, chain) => ({
    address,
    chain,
    lastFetch: { address: null, chain: null },
    page: 1,
    pageSize: 10,
    totalPages: 1,
    allTransactions: [],
    transactions: [],
    filteredTransactions: [],
    loading: false,
    priceCache: {},
    fxCache: {},

    async init() {
      this.$watch('$store.dashboardFilters.year', () => this.onUserFilterChange());
      this.$watch('$store.dashboardFilters.currency', () => this.onUserFilterChange());
      this.$watch('$store.dashboardFilters.hideSmallTx', () => this.onUserFilterChange());
      await this.onUserFilterChange();
    },

    async onUserFilterChange() {
      const year = this.$store.dashboardFilters.year;
      const address = this.address;
      const chain = this.chain;
      // Only show Notyf if fetching
      if (!this.$store.transactionsCache[year]) {
        let loadingToast = null;
        if (this.$store && this.$store.notyf) {
          loadingToast = this.$store.notyf.info('Loading transactions...', { duration: 0 });
        }
        this.$store.transactionsCache[year] = await import('./model.js').then(m => m.getTransactions(address, chain, year));
        if (loadingToast && this.$store && this.$store.notyf && this.$store.notyf.dismiss) {
          this.$store.notyf.dismiss(loadingToast);
        }
        if (this.$store && this.$store.notyf) {
          this.$store.notyf.success('Transactions loaded!');
        }
      }
      await this.fetchTransactions();
    },

    async fetchTransactions() {
      this.loading = true;
      const year = this.$store.dashboardFilters.year;
      // Use cached transactions for the year
      const allTransactions = this.$store.transactionsCache[year] || [];
      const { filtered, totalPages, paginated } = await import('./controller.js').then(m => m.getFilteredPaginatedTransactions({
        address: this.address,
        chain: this.chain,
        year: this.$store.dashboardFilters.year,
        currency: this.$store.dashboardFilters.currency,
        hideSmallTx: this.$store.dashboardFilters.hideSmallTx,
        page: this.page,
        pageSize: this.pageSize,
        priceCache: this.priceCache,
        fxCache: this.fxCache,
      }, allTransactions));
      this.filteredTransactions = filtered;
      this.totalPages = totalPages;
      this.transactions = paginated;
      this.loading = false;
    },

    async updateTransactions() {
      await this.fetchTransactions();
    },

    // Watchers for page, year, and allTransactions
    get watchPage() { this.updateTransactions(); return this.page; },
    get watchYear() { this.updateTransactions(); return this.$store.dashboardFilters.year; },
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
     * Calculate total invested (incoming from external wallets) using Controller.
     * @returns {number}
     */
    invested() {
      return invested(this.filteredTransactions, this.$store.ownWallets);
    },

    /**
     * Calculate total cashed out (outgoing to external wallets) using Controller.
     * @returns {number}
     */
    cashedOut() {
      return cashedOut(this.filteredTransactions, this.$store.ownWallets);
    },

    /**
     * Get the local currency symbol for display using Controller.
     * @returns {string}
     */
    localSymbol() {
      return localSymbol(this.filteredTransactions);
    },
  });
} 