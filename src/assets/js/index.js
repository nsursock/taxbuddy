/**
 * Entrypoint for TaxBuddy frontend JS.
 *
 * - Registers Alpine stores and components from modular files.
 * - Handles theme switching and wallet event listeners.
 *
 * @module index
 */
import '../css/index.css';
import Alpine from 'alpinejs';
import { themeChange } from 'theme-change';
import { registerNotyfStore } from './notyfStore.js';
import { registerWalletStore } from './walletStore.js';
import { registerTransactionsTable } from './transactions/table.js';
import _ from 'lodash';
import ApexCharts from 'apexcharts';
import 'flyonui/dist/helper-apexcharts.js';
import overviewStore from './charts.js';

themeChange();
window.Alpine = Alpine;
window._ = _;
window.ApexCharts = ApexCharts;

// Register Alpine stores and components on init
// This ensures all stores are available before any component mounts
document.addEventListener('alpine:init', () => {
  registerNotyfStore(Alpine);
  registerWalletStore(Alpine, Alpine.store('notyf'));
  registerTransactionsTable();
  Alpine.data('overviewStore', overviewStore);
  // Register global dashboardFilters store
  Alpine.store('dashboardFilters', {
    year: '2024',
    currency: 'USD',
    hideSmallTx: true,
  });
  Alpine.data('walletManager', () => ({
    rememberedWallets: JSON.parse(localStorage.getItem('rememberedWallets') || '[]'),
    
    async rememberCurrentWallet() {
      const wallet = {
        evm: this.$store.wallet.chain === 'ethereum' ? this.$store.wallet.address : null,
        sol: this.$store.wallet.chain === 'solana' ? this.$store.wallet.address : null,
        timestamp: Date.now()
      };
      
      if (wallet.evm || wallet.sol) {
        this.rememberedWallets.push(wallet);
        localStorage.setItem('rememberedWallets', JSON.stringify(this.rememberedWallets));
        if (window.HSOverlay) {
          HSOverlay.close('#remember-wallet-modal');
        }
        this.$store.notyf.success('Wallet addresses remembered successfully');
      }
    },

    removeWallet(index) {
      this.rememberedWallets.splice(index, 1);
      localStorage.setItem('rememberedWallets', JSON.stringify(this.rememberedWallets));
      this.$store.notyf.success('Wallet removed from remembered list');
    },

    init() {
      // Initialize FlyonUI overlay
      if (window.HSOverlay) {
        const modal = new HSOverlay(document.querySelector('#remember-wallet-modal'));
      }
    }
  }));
});

Alpine.start();

// Listen for account changes in OKX/Ethereum wallet and update Alpine store
if (window.ethereum) {
  window.ethereum.on('accountsChanged', (accounts) => {
    const walletStore = Alpine.store('wallet');
    if (accounts && accounts.length > 0) {
      walletStore.address = accounts[0];
      localStorage.setItem('walletAddress', accounts[0]);
    } else {
      walletStore.disconnect();
    }
  });
}