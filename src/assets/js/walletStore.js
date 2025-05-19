/**
 * Alpine store for wallet connection and management.
 * Handles OKX, Ethereum, and Solana wallet logic.
 *
 * @param {object} Alpine - The Alpine.js global object
 * @param {object} notyf - The Notyf notification store
 */
export function registerWalletStore(Alpine, notyf) {
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

    /**
     * Initiate connection to OKX wallet. Opens chain select modal if extension is present.
     */
    async connectOKX() {
      this.connecting = true;
      this.error = null;
      if (!window.okxwallet) {
        notyf.error('OKX Wallet extension not found or not enabled in incognito. Please install or enable it.');
        this.connecting = false;
        return;
      }
      this.needsChainSelect = true;
      this.connecting = false;
      setTimeout(() => {
        if (window.HSOverlay && typeof window.HSOverlay.open === 'function') {
          window.HSOverlay.open('#middle-center-modal');
        }
      }, 100);
    },

    /**
     * Select a blockchain network and connect wallet.
     * @param {string} chain - The chain to connect (e.g., 'ethereum', 'solana')
     */
    async selectChain(chain) {
      this.connecting = true;
      this.error = null;
      
      // Clear existing wallet state before connecting to new chain
      this.disconnect();
      
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
          notyf.error('Failed to switch or connect to Ethereum.');
        }
      } else if (chain.toLowerCase() === 'solana' && window.okxwallet && window.okxwallet.solana) {
        try {
          const resp = await window.okxwallet.solana.connect();
          this.address = resp.publicKey.toString();
          localStorage.setItem('walletAddress', this.address);
        } catch (e) {
          this.address = null;
          localStorage.removeItem('walletAddress');
          notyf.error('Failed to connect to Solana.');
        }
      }
      
      this.connecting = false;
      this.needsChainSelect = false;
      if (window.HSOverlay && typeof window.HSOverlay.close === 'function') {
        window.HSOverlay.close('#middle-center-modal');
      }
      window.location.href = '/dashboard/';
    },

    /**
     * Disconnect the wallet and clear state.
     */
    disconnect() {
      this.address = null;
      this.chain = null;
      this.needsChainSelect = false;
      this.needsReconnect = false;
      localStorage.removeItem('walletAddress');
      localStorage.removeItem('walletChain');
    },

    /**
     * Get the icon name for the current chain.
     * @returns {string}
     */
    chainIcon() {
      if (!this.chain) return 'tabler--wallet';
      if (this.chain.toLowerCase() === 'ethereum') return 'tabler--currency-ethereum';
      if (this.chain.toLowerCase() === 'solana') return 'tabler--currency-solana';
      return 'tabler--wallet';
    },

    /**
     * Reconnect to the wallet if possible.
     */
    async reconnect() {
      this.connecting = true;
      this.error = null;
      
      if (this.chain && this.chain.toLowerCase() === 'ethereum' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts.length > 0) {
            this.address = accounts[0];
            localStorage.setItem('walletAddress', this.address);
          } else {
            this.disconnect();
          }
        } catch (e) {
          this.disconnect();
          notyf.error('Failed to reconnect to Ethereum.');
        }
      } else if (this.chain && this.chain.toLowerCase() === 'solana' && window.okxwallet && window.okxwallet.solana) {
        try {
          const resp = await window.okxwallet.solana.connect();
          this.address = resp.publicKey.toString();
          localStorage.setItem('walletAddress', this.address);
        } catch (e) {
          this.disconnect();
          notyf.error('Failed to reconnect to Solana.');
        }
      }
      
      this.connecting = false;
    }
  });

  // Expose ownWallets globally for Alpine components
  Alpine.store('ownWallets', ownWallets);
} 