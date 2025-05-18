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