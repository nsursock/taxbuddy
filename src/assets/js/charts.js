// charts.js
// Alpine.js-compatible chart initialization for the dashboard overview

import ApexCharts from 'apexcharts';
import { getFilteredPaginatedTransactions } from './transactions/controller.js';

export default function overviewStore() {
  return {
    isLoading: true,
    stats: null,
    chartInstance: null,
    // Transaction state
    address: null,
    chain: null,
    priceCache: {},
    fxCache: {},
    page: 1,
    pageSize: 10,
    totalPages: 1,
    filteredTransactions: [],
    loading: false,
    initialized: false, // Prevent double init

    async init() {
      if (this.initialized) return;
      this.initialized = true;
      this.address = this.$store.wallet.address;
      this.chain = this.$store.wallet.chain;
      // Only trigger Notyf toasts on year change
      this.$watch('$store.dashboardFilters.year', () => this.onUserYearChange());
      // Other filters just update data silently
      this.$watch('$store.dashboardFilters.currency', () => this.onFilterChange());
      this.$watch('$store.dashboardFilters.hideSmallTx', () => this.onFilterChange());
      await this.onUserYearChange();
      this.isLoading = false;
    },

    async onUserYearChange() {
      let loadingToast = null;
      if (this.$store && this.$store.notyf) {
        loadingToast = this.$store.notyf.info('Loading transactions...', { duration: 0 });
      }
      await this.onFilterChange();
      if (loadingToast && this.$store && this.$store.notyf && this.$store.notyf.dismiss) {
        this.$store.notyf.dismiss(loadingToast);
      }
      if (this.$store && this.$store.notyf) {
        this.$store.notyf.success('Transactions loaded!');
      }
    },

    async onFilterChange() {
      this.loading = true;
      const { filtered, totalPages } = await getFilteredPaginatedTransactions({
        address: this.address,
        chain: this.chain,
        year: this.$store.dashboardFilters.year,
        currency: this.$store.dashboardFilters.currency,
        hideSmallTx: this.$store.dashboardFilters.hideSmallTx,
        page: 1, // For overview, get all filtered
        pageSize: 1000,
        priceCache: this.priceCache,
        fxCache: this.fxCache,
      });
      this.filteredTransactions = filtered;
      this.totalPages = totalPages;
      this.loading = false;
      this.updateStatsAndChart();
    },

    async updateStatsAndChart() {
      // Compute stats from filteredTransactions
      this.stats = {
        portfolio: this.filteredTransactions.reduce((sum, tx) => {
          if (tx.local && tx.local !== '—') {
            const amt = parseFloat(tx.local.replace(/[^0-9.\-]/g, ''));
            return sum + (isNaN(amt) ? 0 : amt);
          }
          return sum;
        }, 0),
        change: 0, // TODO: compute change over time
        gains: 0, // TODO: compute 24h gains/losses
        activity: this.filteredTransactions.length,
        chart: this.filteredTransactions.slice(-7).map(tx => {
          if (tx.local && tx.local !== '—') {
            return parseFloat(tx.local.replace(/[^0-9.\-]/g, ''));
          }
          return 0;
        }),
        categories: this.filteredTransactions.slice(-7).map(tx => {
          if (tx.datetime) {
            return new Date(tx.datetime).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
          }
          return '';
        }),
      };
      this.renderChart();
    },

    renderChart() {
      if (this.chartInstance) {
        this.chartInstance.destroy();
      }
      const options = {
        chart: { type: 'area', height: 250, toolbar: { show: false }, fontFamily: 'inherit', foreColor: 'var(--color-base-content)' },
        series: [{ name: 'Portfolio', data: this.stats.chart }],
        xaxis: { categories: this.stats.categories, labels: { style: { colors: 'var(--color-base-content)' } }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: { labels: { style: { colors: 'var(--color-base-content)' } } },
        colors: ['var(--color-primary)', 'var(--color-secondary)'],
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 3 },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1, stops: [0, 90, 100], colorStops: [] } },
        grid: { borderColor: 'var(--color-base-200)', strokeDashArray: 4 },
        tooltip: { theme: 'dark' },
      };
      this.chartInstance = new ApexCharts(document.querySelector('#apex-single-area-chart'), options);
      this.chartInstance.render();
    },

    // Computed: recent and biggest transactions for steppers
    get recentTransactions() {
      // Sort by datetime descending, take 4 most recent
      return [...this.filteredTransactions]
        .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
        .slice(0, 4);
    },
    get biggestTransactions() {
      // Sort by absolute local value descending, take 4 biggest
      return [...this.filteredTransactions]
        .filter(tx => tx.local && tx.local !== '—')
        .sort((a, b) => Math.abs(parseFloat(b.local.replace(/[^0-9.\-]/g, ''))) - Math.abs(parseFloat(a.local.replace(/[^0-9.\-]/g, ''))))
        .slice(0, 4);
    },
  }
} 