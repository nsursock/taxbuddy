// charts.js
// Alpine.js-compatible chart initialization for the dashboard overview

import ApexCharts from 'apexcharts';
import { getFilteredPaginatedTransactions } from './transactions/controller.js';
import { getCurrentPrice, getHistoricalPrice } from './transactions/priceApi.js';
import { getTransactions } from './transactions/model.js';

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
      const year = this.$store.dashboardFilters.year;
      const address = this.address;
      const chain = this.chain;
      // Only show Notyf if fetching
      if (!this.$store.transactionsCache[year]) {
        let loadingToast = null;
        if (this.$store && this.$store.notyf) {
          loadingToast = this.$store.notyf.info('Loading transactions...', { duration: 0 });
        }
        this.$store.transactionsCache[year] = await getTransactions(address, chain, year);
        if (loadingToast && this.$store && this.$store.notyf && this.$store.notyf.dismiss) {
          this.$store.notyf.dismiss(loadingToast);
        }
        if (this.$store && this.$store.notyf) {
          this.$store.notyf.success('Transactions loaded!');
        }
      }
      await this.onFilterChange();
    },

    async onFilterChange() {
      this.loading = true;
      const year = this.$store.dashboardFilters.year;
      // Use cached transactions for the year
      const allTransactions = this.$store.transactionsCache[year] || [];
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
      }, allTransactions);
      this.filteredTransactions = filtered;
      this.totalPages = totalPages;
      this.loading = false;
      // Pass allTransactions to avoid double-fetching
      this.updateStatsAndChart(allTransactions);
    },

    async updateStatsAndChart(allTransactions = null) {
      // Calculate balances per asset (current, filtered)
      const balances = {};
      for (const tx of this.filteredTransactions) {
        if (tx.in && tx.in.amount) {
          const match = tx.in.amount.match(/([\d.\-eE]+)\s*([A-Za-z]+)/);
          if (match) {
            const amount = parseFloat(match[1]);
            const symbol = match[2].toUpperCase();
            balances[symbol] = (balances[symbol] || 0) + amount;
          }
        }
        if (tx.out && tx.out.amount) {
          const match = tx.out.amount.match(/([\d.\-eE]+)\s*([A-Za-z]+)/);
          if (match) {
            const amount = parseFloat(match[1]);
            const symbol = match[2].toUpperCase();
            balances[symbol] = (balances[symbol] || 0) - amount;
          }
        }
      }
      // Supported assets
      const supported = ['ETH', 'SOL', 'USDC', 'USDT'];
      // Fetch current prices for each asset in parallel
      const pricePromises = supported.map(symbol => getCurrentPrice(symbol, this.$store.dashboardFilters.currency, this.fxCache));
      const pricesArr = await Promise.all(pricePromises);
      const prices = {};
      supported.forEach((symbol, i) => { prices[symbol] = pricesArr[i]; });
      // Calculate portfolio value
      let portfolioValue = 0;
      const holdings = [];
      for (const symbol of supported) {
        let bal = balances[symbol] || 0;
        const price = prices[symbol] || 0;
        // Data validation: prevent negative balances for USDC and USDT
        if ((symbol === 'USDC' || symbol === 'USDT') && bal < 0) {
          bal = 0;
        }
        if (Math.abs(bal) > 0.00001) {
          holdings.push({ symbol, balance: bal, price, value: bal * price });
        }
        portfolioValue += bal * price;
      }

      // --- Accurate Percentage Change Calculations (using all transactions) ---
      if (!allTransactions) {
        allTransactions = await getTransactions(this.address, this.chain, this.$store.dashboardFilters.year);
      }
      // 1. Month-to-date (start of month)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfMonthTime = startOfMonth.getTime();
      const startOfMonthStr = startOfMonth.toISOString().slice(0, 10);
      // 2. 24h ago
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dayAgoTime = dayAgo.getTime();
      const dayAgoStr = dayAgo.toISOString().slice(0, 10);
      // Reconstruct balances as of each historical date
      const balancesAtMonth = {};
      const balancesAtDay = {};
      for (const symbol of supported) {
        balancesAtMonth[symbol] = 0;
        balancesAtDay[symbol] = 0;
      }
      for (const tx of allTransactions) {
        const txTime = tx.datetime ? new Date(tx.datetime).getTime() : null;
        if (!txTime) continue;
        // For start of month
        if (txTime <= startOfMonthTime) {
          if (tx.in && tx.in.amount) {
            const match = tx.in.amount.match(/([\d.\-eE]+)\s*([A-Za-z]+)/);
            if (match) {
              const amount = parseFloat(match[1]);
              const symbol = match[2].toUpperCase();
              balancesAtMonth[symbol] = (balancesAtMonth[symbol] || 0) + amount;
            }
          }
          if (tx.out && tx.out.amount) {
            const match = tx.out.amount.match(/([\d.\-eE]+)\s*([A-Za-z]+)/);
            if (match) {
              const amount = parseFloat(match[1]);
              const symbol = match[2].toUpperCase();
              balancesAtMonth[symbol] = (balancesAtMonth[symbol] || 0) - amount;
            }
          }
        }
        // For 24h ago
        if (txTime <= dayAgoTime) {
          if (tx.in && tx.in.amount) {
            const match = tx.in.amount.match(/([\d.\-eE]+)\s*([A-Za-z]+)/);
            if (match) {
              const amount = parseFloat(match[1]);
              const symbol = match[2].toUpperCase();
              balancesAtDay[symbol] = (balancesAtDay[symbol] || 0) + amount;
            }
          }
          if (tx.out && tx.out.amount) {
            const match = tx.out.amount.match(/([\d.\-eE]+)\s*([A-Za-z]+)/);
            if (match) {
              const amount = parseFloat(match[1]);
              const symbol = match[2].toUpperCase();
              balancesAtDay[symbol] = (balancesAtDay[symbol] || 0) - amount;
            }
          }
        }
      }
      // Calculate historical portfolio values in parallel
      const priceMonthPromises = supported.map(symbol => getHistoricalPrice(symbol, startOfMonthStr, this.$store.dashboardFilters.currency, this.priceCache, this.fxCache));
      const priceDayPromises = supported.map(symbol => getHistoricalPrice(symbol, dayAgoStr, this.$store.dashboardFilters.currency, this.priceCache, this.fxCache));
      const [pricesMonthArr, pricesDayArr] = await Promise.all([
        Promise.all(priceMonthPromises),
        Promise.all(priceDayPromises)
      ]);
      let portfolioStartMonth = 0;
      let portfolioDayAgo = 0;
      supported.forEach((symbol, i) => {
        const balMonth = balancesAtMonth[symbol] || 0;
        const balDay = balancesAtDay[symbol] || 0;
        const priceMonth = pricesMonthArr[i];
        const priceDay = pricesDayArr[i];
        if (priceMonth) portfolioStartMonth += balMonth * priceMonth;
        if (priceDay) portfolioDayAgo += balDay * priceDay;
      });
      // Calculate percentage changes
      let change = 0;
      if (portfolioStartMonth > 0) {
        change = ((portfolioValue - portfolioStartMonth) / portfolioStartMonth) * 100;
      }
      let gains = 0;
      if (portfolioDayAgo > 0) {
        gains = ((portfolioValue - portfolioDayAgo) / portfolioDayAgo) * 100;
      }
      // --- BEGIN MONTHLY AGGREGATION ---
      const year = this.$store.dashboardFilters.year || new Date().getFullYear();
      const today = new Date();
      const lastMonth = (parseInt(year) === today.getFullYear()) ? today.getMonth() : 11;
      const months = [];
      for (let m = 0; m <= lastMonth; m++) {
        let lastDay;
        if (m === today.getMonth() && parseInt(year) === today.getFullYear()) {
          lastDay = new Date(today);
        } else {
          lastDay = new Date(year, m + 1, 0);
        }
        months.push(lastDay);
      }
      const monthlyLabels = months.map(monthEnd => monthEnd.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
      // For each month, reconstruct balances and fetch prices in batch
      let runningBalances = {};
      for (const symbol of supported) runningBalances[symbol] = 0;
      const txs = [...allTransactions].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
      let txIdx = 0;
      // Precompute balances at each month end
      const balancesByMonth = months.map(() => ({ ...runningBalances }));
      for (let i = 0; i < months.length; i++) {
        const monthEnd = months[i];
        while (
          txIdx < txs.length &&
          txs[txIdx].datetime &&
          new Date(txs[txIdx].datetime) <= monthEnd
        ) {
          const tx = txs[txIdx];
          if (tx.in && tx.in.amount) {
            const match = tx.in.amount.match(/([\d.\-eE]+)\s*([A-Za-z]+)/);
            if (match) {
              const amount = parseFloat(match[1]);
              const symbol = match[2].toUpperCase();
              if (supported.includes(symbol)) runningBalances[symbol] = (runningBalances[symbol] || 0) + amount;
            }
          }
          if (tx.out && tx.out.amount) {
            const match = tx.out.amount.match(/([\d.\-eE]+)\s*([A-Za-z]+)/);
            if (match) {
              const amount = parseFloat(match[1]);
              const symbol = match[2].toUpperCase();
              if (supported.includes(symbol)) runningBalances[symbol] = (runningBalances[symbol] || 0) - amount;
            }
          }
          txIdx++;
        }
        balancesByMonth[i] = { ...runningBalances };
      }
      // Batch fetch all historical prices for all months and assets
      const priceFetches = [];
      months.forEach((monthEnd, i) => {
        const monthStr = monthEnd.toISOString().slice(0, 10);
        supported.forEach(symbol => {
          priceFetches.push(getHistoricalPrice(symbol.toLowerCase(), monthStr, this.$store.dashboardFilters.currency, this.priceCache, this.fxCache));
        });
      });
      const allMonthPrices = await Promise.all(priceFetches);
      // Now compute monthly portfolio values
      const monthlyValues = [];
      for (let i = 0; i < months.length; i++) {
        let value = 0;
        for (let j = 0; j < supported.length; j++) {
          const bal = balancesByMonth[i][supported[j]] || 0;
          const price = allMonthPrices[i * supported.length + j] || 0;
          value += bal * price;
        }
        monthlyValues.push(Number(value.toFixed(2)));
      }
      // Find the last transaction date for portfolio value date
      let portfolioDate = null;
      if (this.filteredTransactions.length > 0) {
        const lastTx = this.filteredTransactions.reduce((a, b) => new Date(a.datetime) > new Date(b.datetime) ? a : b);
        portfolioDate = lastTx.datetime;
      }
      // Calculate total gains for the year (portfolioValue - value at start of year)
      // Find start of year value
      const startOfYear = new Date(year, 0, 1);
      const startOfYearStr = startOfYear.toISOString().slice(0, 10);
      // Reconstruct balances as of start of year
      const balancesAtYear = {};
      for (const symbol of supported) balancesAtYear[symbol] = 0;
      for (const tx of allTransactions) {
        const txTime = tx.datetime ? new Date(tx.datetime).getTime() : null;
        if (!txTime) continue;
        if (txTime <= startOfYear.getTime()) {
          if (tx.in && tx.in.amount) {
            const match = tx.in.amount.match(/([\d.\-eE]+)\s*([A-Za-z]+)/);
            if (match) {
              const amount = parseFloat(match[1]);
              const symbol = match[2].toUpperCase();
              balancesAtYear[symbol] = (balancesAtYear[symbol] || 0) + amount;
            }
          }
          if (tx.out && tx.out.amount) {
            const match = tx.out.amount.match(/([\d.\-eE]+)\s*([A-Za-z]+)/);
            if (match) {
              const amount = parseFloat(match[1]);
              const symbol = match[2].toUpperCase();
              balancesAtYear[symbol] = (balancesAtYear[symbol] || 0) - amount;
            }
          }
        }
      }
      // Get prices at start of year
      const priceYearPromises = supported.map(symbol => getHistoricalPrice(symbol, startOfYearStr, this.$store.dashboardFilters.currency, this.priceCache, this.fxCache));
      const pricesYearArr = await Promise.all(priceYearPromises);
      let portfolioStartOfYear = 0;
      supported.forEach((symbol, i) => {
        const balYear = balancesAtYear[symbol] || 0;
        const priceYear = pricesYearArr[i];
        if (priceYear) portfolioStartOfYear += balYear * priceYear;
      });
      const totalGains = portfolioValue - portfolioStartOfYear;
      // ---
      this.stats = {
        portfolio: portfolioValue,
        portfolioDate,
        holdings,
        totalGains,
        totalTransactions: this.filteredTransactions.length,
        chart: monthlyValues,
        categories: monthlyLabels,
      };
      // --- END MONTHLY AGGREGATION ---
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
    get currencySymbol() {
      return this.$store.dashboardFilters.currency === 'EUR' ? '€' : '$';
    },
  }
} 