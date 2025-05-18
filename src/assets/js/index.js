import '../css/index.css';
import { Notyf } from 'notyf';
// import 'notyf/notyf.min.css';
// import 'flyonui/src/vendor/notyf.css'; // Make sure this path is correct for your setup

import Alpine from 'alpinejs'
import { themeChange } from "theme-change";
themeChange();

window.Alpine = Alpine

// Add Alpine extensions here

// Singleton Notyf instance for Alpine store
let notyfInstance = null;
function getNotyf() {
  if (!notyfInstance) {
    notyfInstance = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'bottom' },
      types: [
        {
          type: 'success',
          background: 'var(--color-success)',
          icon: { className: 'icon-[tabler--check]', tagName: 'i' }
        },
        {
          type: 'error',
          background: 'var(--color-error)',
          icon: { className: 'icon-[tabler--alert-circle]', tagName: 'i' }
        },
        {
          type: 'info',
          background: 'var(--color-info)',
          icon: { className: 'icon-[tabler--info-circle]', tagName: 'i' }
        },
        {
          type: 'warning',
          background: 'var(--color-warning)',
          icon: { className: 'icon-[tabler--alert-triangle]', tagName: 'i' }
        }
      ]
    });
  }
  return notyfInstance;
}

document.addEventListener('alpine:init', () => {
  // Ensure both address and chain are set together, otherwise set both to null
  let storedAddress = localStorage.getItem('walletAddress');
  let storedChain = localStorage.getItem('walletChain');
  if (!storedAddress || !storedChain) {
    storedAddress = null;
    storedChain = null;
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('walletChain');
  }

  // Parse own wallet addresses from env and add to Alpine store
  const ownWallets = [
    ...(import.meta.env.VITE_EVM_WALLETS ? import.meta.env.VITE_EVM_WALLETS.split(',').map(a => a.trim().toLowerCase()) : []),
    ...(import.meta.env.VITE_SOL_WALLETS ? import.meta.env.VITE_SOL_WALLETS.split(',').map(a => a.trim().toLowerCase()) : [])
  ].filter(Boolean);

  Alpine.store('wallet', {
    address: storedAddress,
    chain: storedChain,
    connecting: false,
    error: null,
    needsChainSelect: false,
    needsReconnect: false,

    async connectOKX() {
      this.connecting = true;
      this.error = null;
      if (!window.okxwallet) {
        this.$store.notyf.error('OKX Wallet extension not found or not enabled in incognito. Please install or enable it.');
        this.connecting = false;
        return;
      }
      // No address/chain yet, just open chain select modal
      this.needsChainSelect = true;
      this.connecting = false;
      setTimeout(() => {
        if (window.HSOverlay && typeof window.HSOverlay.open === 'function') {
          window.HSOverlay.open('#middle-center-modal');
        }
      }, 100);
    },

    async selectChain(chain) {
      this.chain = chain;
      localStorage.setItem('walletChain', chain);
      if (chain.toLowerCase() === 'ethereum' && window.ethereum) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x1' }],
          });
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts.length > 0) {
            this.address = accounts[0];
            localStorage.setItem('walletAddress', this.address);
          } else {
            this.address = null;
            localStorage.removeItem('walletAddress');
          }
        } catch (e) {
          this.address = null;
          localStorage.removeItem('walletAddress');
          this.$store.notyf.error('Failed to switch or connect to Ethereum.');
        }
      } else if (chain.toLowerCase() === 'solana' && window.okxwallet && window.okxwallet.solana) {
        try {
          const resp = await window.okxwallet.solana.connect();
          this.address = resp.publicKey.toString();
          localStorage.setItem('walletAddress', this.address);
        } catch (e) {
          this.address = null;
          localStorage.removeItem('walletAddress');
          this.$store.notyf.error('Failed to connect to Solana.');
        }
      }
      this.needsChainSelect = false;
      if (window.HSOverlay && typeof window.HSOverlay.close === 'function') {
        window.HSOverlay.close('#middle-center-modal');
      }
      window.location.href = '/dashboard/';
    },

    disconnect() {
      this.address = null;
      this.chain = null;
      this.needsChainSelect = false;
      this.needsReconnect = false;
      localStorage.removeItem('walletAddress');
      localStorage.removeItem('walletChain');
    },

    chainIcon() {
      if (!this.chain) return 'tabler--wallet';
      if (this.chain.toLowerCase() === 'ethereum') return 'tabler--currency-ethereum';
      if (this.chain.toLowerCase() === 'solana') return 'tabler--currency-solana';
      return 'tabler--wallet';
    },

    reconnect() {
      if (this.chain && this.chain.toLowerCase() === 'ethereum' && window.ethereum) {
        window.ethereum.request({ method: 'eth_requestAccounts' }).then(accounts => {
          if (accounts && accounts.length > 0) {
            this.address = accounts[0];
            localStorage.setItem('walletAddress', this.address);
          }
        });
      } else if (this.chain && this.chain.toLowerCase() === 'solana' && window.okxwallet && window.okxwallet.solana) {
        window.okxwallet.solana.connect().then(resp => {
          this.address = resp.publicKey.toString();
          localStorage.setItem('walletAddress', this.address);
        });
      }
    }
  });

  Alpine.store('notyf', {
    success(msg, opts = {}) { return getNotyf().success(msg, opts); },
    error(msg, opts = {}) { return getNotyf().error(msg, opts); },
    info(msg, opts = {}) { return getNotyf().open({ type: 'info', message: msg, ...opts }); },
    warning(msg, opts = {}) { return getNotyf().open({ type: 'warning', message: msg, ...opts }); }
  });

  // Expose ownWallets globally for Alpine components
  Alpine.store('ownWallets', ownWallets);
});

// Alpine component for fetching and displaying EVM transactions in the dashboard
window.transactionsTable = (address, chain, year = '2024') => ({
  address,
  chain,
  year,
  currency: 'USD',
  hideSmallTx: true,
  lastFetch: { address: null, chain: null, year: null },
  page: 1,         // Current page
  pageSize: 10,    // Transactions per page
  totalPages: 1,   // Will be calculated
  allTransactions: [], // Store all filtered transactions
  transactions: [],
  filteredTransactions: [], // Add this to ensure it's always defined
  loading: false,
  priceCache: {}, // { 'eth-YYYY-MM-DD-USD': price, 'sol-YYYY-MM-DD-EUR': price }
  fxCache: {}, // { 'YYYY-MM-DD-USD-EUR': rate }
  async getHistoricalPrice(symbol, dateStr) {
    // symbol: 'eth' or 'sol', dateStr: 'YYYY-MM-DD'
    const currency = this.currency || 'USD';
    const cacheKey = `${symbol}-${dateStr}-${currency}`;
    if (this.priceCache[cacheKey]) return this.priceCache[cacheKey];

    // Map symbol to Binance pair
    const pair = symbol === 'eth' ? 'ETHUSDT' : symbol === 'sol' ? 'SOLUSDT' : null;
    if (!pair) return null;

    // Get UTC midnight for the date
    const date = new Date(dateStr + 'T00:00:00Z');
    const startTime = date.getTime();
    const endTime = startTime + 24 * 60 * 60 * 1000;

    // Fetch Binance kline for the day
    let usdPrice = null;
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&startTime=${startTime}&endTime=${endTime}&limit=1`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        usdPrice = parseFloat(data[0][4]); // [4] is the close price
      }
    } catch (e) {
      return null;
    }
    if (!usdPrice) return null;

    // If USD, return directly
    if (currency === 'USD') {
      this.priceCache[cacheKey] = usdPrice;
      return usdPrice;
    }

    // If EUR, use Frankfurter API for latest USD/EUR rate (supports CORS, no API key)
    if (currency === 'EUR') {
      const fxKey = `latest-USD-EUR`;
      let fxRate = this.fxCache[fxKey];
      if (!fxRate) {
        try {
          const fxResp = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR');
          const fxData = await fxResp.json();
          if (fxData && fxData.rates && fxData.rates.EUR) {
            fxRate = fxData.rates.EUR;
            this.fxCache[fxKey] = fxRate;
          } else {
            fxRate = null;
          }
        } catch (e) {
          fxRate = null;
        }
      }
      if (fxRate) {
        const eurPrice = usdPrice * fxRate;
        this.priceCache[cacheKey] = eurPrice;
        return eurPrice;
      } else {
        return null;
      }
    }
    return null;
  },
  // Helper to filter and paginate transactions
  async updateTransactions() {
    let filtered = [];
    const localThreshold = 1.0; // 1 USD or 1 EUR
    function parseAmount(str) {
      if (!str) return 0;
      // Remove currency suffix and commas, then parse
      return parseFloat(str.replace(/[^0-9.]/g, ''));
    }
    const currency = this.currency || 'USD';
    const currencySymbol = currency === 'EUR' ? '€' : '$';
    if (!this.chain || this.chain.toLowerCase() === 'ethereum') {
      // Calculate local (USD/EUR) amount for each tx and filter by local value if needed
      filtered = [];
      for (const tx of this.allTransactions) {
        const txYear = new Date(tx.datetime).getFullYear().toString();
        if (txYear !== this.year) continue;
        const dateStr = tx.dateISO;
        let amount = 0;
        let localValue = null;
        // Detect token type from amount string
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
          // USDC/USDT: 1:1 with USD, or convert to EUR
          if (currency === 'USD') {
            localValue = amount;
            tx.local = `${currencySymbol}${localValue.toFixed(2)}`;
          } else if (currency === 'EUR') {
            // Convert to EUR using latest FX rate
            const fxKey = `latest-USD-EUR`;
            let fxRate = this.fxCache[fxKey];
            if (!fxRate) {
              try {
                const fxResp = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR');
                const fxData = await fxResp.json();
                if (fxData && fxData.rates && fxData.rates.EUR) {
                  fxRate = fxData.rates.EUR;
                  this.fxCache[fxKey] = fxRate;
                } else {
                  fxRate = null;
                }
              } catch (e) {
                fxRate = null;
              }
            }
            if (fxRate) {
              localValue = amount * fxRate;
              tx.local = `${currencySymbol}${localValue.toFixed(2)}`;
            } else {
              tx.local = '—';
            }
          }
        } else if (dateStr && amount) {
          // ETH or other tokens: use historical price
          const price = await this.getHistoricalPrice('eth', dateStr);
          localValue = price ? amount * price : null;
          tx.local = price ? `${currencySymbol}${localValue.toFixed(2)}` : '—';
        } else {
          tx.local = '—';
        }
        if (this.hideSmallTx && (localValue === null || localValue < localThreshold)) continue;
        filtered.push(tx);
      }
    } else if (this.chain && this.chain.toLowerCase() === 'solana') {
      // Calculate local (USD/EUR) amount for each tx and filter by local value if needed
      filtered = [];
      for (const tx of this.allTransactions) {
        const txDate = tx.datetime ? new Date(tx.datetime) : null;
        if (!txDate || txDate.getFullYear().toString() !== this.year) continue;
        const dateStr = tx.dateISO;
        const amount = tx.in ? parseAmount(tx.in.amount) : (tx.out ? parseAmount(tx.out.amount) : 0);
        let localValue = null;
        if (dateStr && amount) {
          const price = await this.getHistoricalPrice('sol', dateStr);
          localValue = price ? amount * price : null;
          tx.local = price ? `${currencySymbol}${localValue.toFixed(2)}` : '—';
        } else {
          tx.local = '—';
        }
        if (this.hideSmallTx && (localValue === null || localValue < localThreshold)) continue;
        filtered.push(tx);
      }
    }
    // Store filtered transactions for stats (before pagination)
    this.filteredTransactions = filtered;
    this.totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));
    if (this.page > this.totalPages) this.page = this.totalPages;
    if (this.page < 1) this.page = 1;
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.transactions = filtered.slice(start, end);
  },
  async fetchTransactions() {
    // Prevent duplicate fetches for the same address/chain/year
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

    // Show loading notification (persistent)
    let loadingToast = null;
    if (this.$store && this.$store.notyf) {
      loadingToast = this.$store.notyf.info('Loading transactions...', { duration: 0 });
    }

    // EVM chains (Ethereum, Arbitrum, etc.)
    if (!this.chain || this.chain.toLowerCase() === 'ethereum') {
      const explorers = [
        { name: 'Ethereum', url: 'https://api.etherscan.io/api', apiKey: import.meta.env.VITE_ETHERSCAN_API_KEY, usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: { USDC: 6, USDT: 6 } },
        { name: 'Arbitrum', url: 'https://api.arbiscan.io/api', apiKey: import.meta.env.VITE_ARBISCAN_API_KEY, usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', usdt: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', decimals: { USDC: 6, USDT: 6 } },
        // { name: 'Polygon', url: 'https://api.polygonscan.com/api', apiKey: import.meta.env.VITE_POLYGONSCAN_API_KEY },
        // Add more EVM chains here
      ];
      for (const explorer of explorers) {
        try {
          // Fetch native ETH transactions
          const resp = await fetch(`${explorer.url}?module=account&action=txlist&address=${this.address}&startblock=0&endblock=99999999&sort=desc&apikey=${explorer.apiKey}`);
          const data = await resp.json();
          if (data.status === '1') {
            const txs = data.result
              .filter(tx => {
                const txYear = new Date(tx.timeStamp * 1000).getFullYear().toString();
                return txYear === this.year;
              })
              .map(tx => ({
                type: tx.to && tx.to.toLowerCase() === this.address.toLowerCase() ? 'in' : 'out',
                datetime: new Date(tx.timeStamp * 1000).toLocaleString(),
                dateISO: new Date(tx.timeStamp * 1000).toISOString().slice(0, 10),
                out: tx.to && tx.to.toLowerCase() !== this.address.toLowerCase() ? { amount: `${(parseFloat(tx.value) / 1e18).toFixed(4)} ETH`, wallet: tx.to.slice(0, 6) + '...' + tx.to.slice(-4) } : null,
                in: tx.to && tx.to.toLowerCase() === this.address.toLowerCase() ? { amount: `${(parseFloat(tx.value) / 1e18).toFixed(4)} ETH`, wallet: tx.from.slice(0, 6) + '...' + tx.from.slice(-4) } : null,
                local: '—',
                hash: tx.hash,
              }));
            this.allTransactions.push(...txs);
          }

          // Fetch ERC20 token transfers (USDC/USDT)
          const tokenResp = await fetch(`${explorer.url}?module=account&action=tokentx&address=${this.address}&startblock=0&endblock=99999999&sort=desc&apikey=${explorer.apiKey}`);
          const tokenData = await tokenResp.json();
          if (tokenData.status === '1') {
            const usdcAddr = explorer.usdc.toLowerCase();
            const usdtAddr = explorer.usdt.toLowerCase();
            const tokenTxs = tokenData.result
              .filter(tx => {
                const txYear = new Date(tx.timeStamp * 1000).getFullYear().toString();
                const tokenAddr = tx.contractAddress.toLowerCase();
                return txYear === this.year && (tokenAddr === usdcAddr || tokenAddr === usdtAddr);
              })
              .map(tx => {
                const tokenAddr = tx.contractAddress.toLowerCase();
                const symbol = tokenAddr === usdcAddr ? 'USDC' : 'USDT';
                const decimals = explorer.decimals[symbol];
                const amount = (parseFloat(tx.value) / Math.pow(10, decimals)).toFixed(2);
                const isIn = tx.to && tx.to.toLowerCase() === this.address.toLowerCase();
                const isOut = tx.from && tx.from.toLowerCase() === this.address.toLowerCase();
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
            this.allTransactions.push(...tokenTxs);
          }
        } catch (e) {
          console.error(`Error fetching from ${explorer.name}:`, e);
        }
      }
      this.updateTransactions();
    }

    // Solana (Helius API)
    if (this.chain && this.chain.toLowerCase() === 'solana') {
      try {
        // Only fetch if allTransactions is empty or address/chain changed
        if (!this.allTransactions.length || this._lastAddress !== this.address || this._lastChain !== this.chain) {
          const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY;
          const url = `https://api.helius.xyz/v0/addresses/${this.address}/transactions?api-key=${heliusApiKey}&limit=100`;
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
            if (txListResp.status === 429) {
              this.$store.notyf.error('You have hit the Helius API rate limit. Please wait and try again later.');
            } else if (txListResp.status === 400) {
              this.$store.notyf.error('Helius API Bad Request. Please check the address and try again.');
            }
            console.error(errorMsg);
            return;
          }
          const txList = await txListResp.json();
          this.allTransactions = Array.isArray(txList) ? txList.map(tx => {
            // Map Solana txs to table format
            const txDate = tx.timestamp ? new Date(tx.timestamp * 1000) : null;
            let type = 'other';
            let out = null;
            let inTx = null;
            let local = '—';
            const shorten = addr => addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';
            if (Array.isArray(tx.nativeTransfers)) {
              const transfer = tx.nativeTransfers.find(t => t.fromUserAccount === this.address || t.toUserAccount === this.address);
              if (transfer) {
                if (transfer.fromUserAccount === this.address) {
                  type = 'out';
                  out = { amount: `${(transfer.amount / 1e9).toFixed(4)} SOL`, wallet: shorten(transfer.toUserAccount) };
                } else if (transfer.toUserAccount === this.address) {
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
          this._lastAddress = this.address;
          this._lastChain = this.chain;
        }
        this.updateTransactions();
      } catch (e) {
        console.error('Error fetching from Helius:', e);
      }
    }

    this.loading = false;

    // Dismiss loading toast and show loaded notification
    if (loadingToast) {
      getNotyf().dismiss(loadingToast);
    }
    if (this.$store && this.$store.notyf) {
      this.$store.notyf.success('Transactions loaded!');
    }
  },
  // Watchers for page, year, and allTransactions
  get watchPage() { this.updateTransactions(); return this.page; },
  get watchYear() { this.updateTransactions(); return this.year; },
  get watchAllTransactions() { this.updateTransactions(); return this.allTransactions; },
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
  invested() {
    let sum = 0;
    const ownWallets = this.$store.ownWallets || [];
    // Fallback: if no ownWallets are set, treat all as external for demo realism
    const treatAllAsExternal = ownWallets.length === 0;
    for (const tx of this.filteredTransactions) {
      if (tx.in && tx.in.wallet && tx.in.wallet.length > 0) {
        let from = (tx.in.walletFull || tx.in.wallet).toLowerCase();
        if (treatAllAsExternal || !ownWallets.includes(from)) {
          let amt = parseFloat(tx.local && tx.local !== '—' ? tx.local.replace(/[^0-9.\-]/g, '') : '0');
          sum += isNaN(amt) ? 0 : amt;
        }
      }
    }
    return sum;
  },
  cashedOut() {
    let sum = 0;
    const ownWallets = this.$store.ownWallets || [];
    // Fallback: if no ownWallets are set, treat all as external for demo realism
    const treatAllAsExternal = ownWallets.length === 0;
    for (const tx of this.filteredTransactions) {
      if (tx.out && tx.out.wallet && tx.out.wallet.length > 0) {
        let to = (tx.out.walletFull || tx.out.wallet).toLowerCase();
        if (treatAllAsExternal || !ownWallets.includes(to)) {
          let amt = parseFloat(tx.local && tx.local !== '—' ? tx.local.replace(/[^0-9.\-]/g, '') : '0');
          sum += isNaN(amt) ? 0 : amt;
        }
      }
    }
    return sum;
  },
  localSymbol() {
    for (const tx of this.filteredTransactions) {
      if (tx.local && tx.local !== '—') {
        const match = tx.local.match(/^[^0-9.\-]+/);
        return match ? match[0] : '$';
      }
    }
    return '$';
  },
});

Alpine.start()

// Listen for account changes in OKX/Ethereum wallet and update Alpine store
if (window.ethereum) {
  window.ethereum.on('accountsChanged', (accounts) => {
    const walletStore = Alpine.store('wallet');
    if (accounts && accounts.length > 0) {
      walletStore.address = accounts[0];
      localStorage.setItem('walletAddress', accounts[0]);
      // Optionally, refresh the page or UI if needed
    } else {
      walletStore.disconnect();
    }
  });
}