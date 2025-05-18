# TaxBuddy – Crypto Tax Reporting App (France MVP)

A user-friendly crypto tax reporting application designed to simplify generating tax reports for cryptocurrency transactions, starting with the French tax system. Built with a modern stack: 11ty, Vite, Tailwind CSS, and Alpine.js. The MVP is strictly Web3-focused, using wallet-based authentication and local storage for a seamless, privacy-first experience.

---

## 🚀 Features

- **Web3 Wallet Authentication**  
  - Connect with OKX and other wallets (no email/password)
  - Multi-chain support (initial focus: OKX)
  - Local storage of wallet preferences

- **Dashboard Experience**  
  - Left drawer navigation, header with wallet status, and informative footer
  - Main pages: Overview, Wallets, Transactions, Tax Report

- **Performance & SEO**  
  - Image optimization, sitemap generation, and SEO meta includes

- **Modern Tooling**  
  - Vite for fast builds and hot reloads
  - Tailwind CSS for rapid, responsive UI
  - Alpine.js for interactive components

---

## 🏗️ Tech Stack

- **Frontend:** Alpine.js, Tailwind CSS (v3, no CDN)
- **Build Tools:** 11ty (Eleventy), Vite
- **Authentication:** Web3 wallet-based (no traditional auth)
- **Storage:** Local storage (MVP)
- **Deployment:** Static hosting (Netlify, Vercel, etc.)

---

## 🧑‍💻 Getting Started

### Prerequisites

- Node.js v16+
- npm or yarn

### Installation

```bash
git clone https://github.com/your-username/taxbuddy.git
cd taxbuddy
npm install
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## 🗂️ Project Structure

```
.
├── src/            # Source files (pages, layouts, components)
├── public/         # Static assets
├── .eleventy.js    # 11ty config
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## 🧩 Core Concepts

- **Web3-First:**  
  All authentication and user data are handled via wallet connections and local storage. No backend or email/password required.

- **Local Storage:**  
  User wallet data and preferences are stored locally for privacy and speed.

- **Responsive & Accessible:**  
  Built with Tailwind CSS and Alpine.js for a modern, mobile-friendly experience.

- **French Tax Compliance:**  
  MVP is tailored for French crypto tax regulations, with plans for future expansion.

---

## 🛡️ Security & Best Practices

- No sensitive data leaves the user's device (local storage only)
- Error handling and loading states throughout the app
- Designed for future database integration and scalability

---

## 🧪 Testing & Quality

- Manual and automated testing recommended for all wallet flows
- Responsive design tested across devices
- Error and loading states implemented for all async actions

---

## 📈 Roadmap

- Expand wallet and chain support
- Add backend/database integration
- Support additional tax jurisdictions
- Enhanced analytics and monitoring

---

## 📄 License

MIT

---

## 🤝 Contributing

Pull requests and issues are welcome! Please open an issue to discuss your ideas or report bugs.

---

**Built with ❤️ for the French crypto community.**

# TaxBuddy Frontend Code Structure

## Modular JavaScript Architecture

The frontend JavaScript is organized for clarity, modularity, and maintainability. All major logic is split into separate modules under `src/assets/js/`:

### Main Modules

- **index.js**: Entrypoint. Registers Alpine stores/components and handles global listeners.
- **walletStore.js**: Alpine store for wallet connection logic (OKX, Ethereum, Solana). Handles connect, disconnect, chain selection, and state.
- **notyfStore.js**: Alpine store for notifications using Notyf. Provides success, error, info, and warning methods.
- **transactionsTable.js**: Alpine component for fetching, filtering, and displaying blockchain transactions. Handles pagination, price lookups, and stats.
- **utils.js**: Utility functions (e.g., parseAmount) used by other modules.

### How to Extend

- **Add a new Alpine store**: Create a new file (e.g., `myStore.js`), export a `registerMyStore(Alpine)` function, and call it in `index.js` inside the `alpine:init` event.
- **Add a new Alpine component**: Create a new file (e.g., `myComponent.js`), export a `registerMyComponent()` function, and call it in `index.js`.
- **Add utilities**: Place shared helpers in `utils.js` and import where needed.

### Example: Adding a Store
```js
// src/assets/js/myStore.js
export function registerMyStore(Alpine) {
  Alpine.store('myStore', { ... });
}
```
And in `index.js`:
```js
import { registerMyStore } from './myStore.js';
document.addEventListener('alpine:init', () => {
  registerMyStore(Alpine);
});
```

### Comments & Documentation
- All modules use JSDoc for function and parameter documentation.
- Inline comments explain tricky logic, API calls, and Alpine usage.

### Where to Find Logic
- **Wallet connection**: `walletStore.js`
- **Notifications**: `notyfStore.js`
- **Transactions table**: `transactionsTable.js`
- **Utilities**: `utils.js`

---

For further details, see the top of each JS file and inline comments.