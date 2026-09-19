# SiteSync — Enterprise Supply Chain & Multi-Tier Distribution Platform

SiteSync is a modern, enterprise-grade supply chain and distribution management platform tailored for the construction and building materials sector (Cement, TMT Steel Rebar, aggregates, and structural products). It unifies Distributors, Dealers, Commercial Partners/Contractors, and Trade Influencers into a coordinated, real-time ecosystem.

---

## 🌟 Architectural Overview

SiteSync organizes complex building material logistics into dedicated, role-tailored workspaces while preserving seamless transactional and inventory synchronization:

```
                  ┌─────────────────────────────────────────┐
                  │             SITESYNC PLATFORM           │
                  └────────────────────┬────────────────────┘
                                       │
         ┌──────────────────┬──────────┴──────────┬──────────────────┐
         │                  │                     │                  │
         ▼                  ▼                     ▼                  ▼
┌─────────────────┐  ┌───────────────┐   ┌─────────────────┐  ┌───────────────┐
│  DISTRIBUTOR    │  │    DEALER     │   │     PARTNER     │  │  INFLUENCER   │
│     PORTAL      │  │    PORTAL     │   │     PORTAL      │  │    PORTAL     │
├─────────────────┤  ├───────────────┤   ├─────────────────┤  ├───────────────┤
│ • Master Stocks │  │ • Local Stock │   │ • Bulk Orders   │  │ • QR Tracking │
│ • Wholesale Ord │  │ • Order Goods │   │ • Project Sites │  │ • Commission  │
│ • Dealer Netwk  │  │ • Customer CRM│   │ • Statement Ledg│  │ • Tier Perks  │
│ • Reward Admin  │  │ • Rewards Red │   │ • Direct Quotes │  │ • Spotlights  │
└─────────────────┘  └───────────────┘   └─────────────────┘  └───────────────┘
```

---

## 📂 Project Structure

The project follows a clean, modular, enterprise-standard directory architecture:

```text
SiteSync/
├── server/                    # Backend services & Local API bridge
│   └── api-bridge.ts          # Vite API middleware connecting local storage & DB
├── src/
│   ├── components/
│   │   ├── analytics/         # Sales, volume, and territory analytics reports
│   │   │   └── AnalyticsReportsView.tsx
│   │   ├── auth/              # Multi-role authentication & registration flows
│   │   │   └── AuthFlow.tsx
│   │   ├── billing/           # GST/Commercial invoicing workspaces
│   │   │   └── InvoiceWorkspace.tsx
│   │   ├── dashboard/         # Executive metric widgets and quick actions
│   │   │   └── DashboardView.tsx
│   │   ├── directory/         # Dealer network, customer CRM, and accounts
│   │   │   ├── CustomerManagement.tsx
│   │   │   ├── DealerManagement.tsx
│   │   │   └── DistributorNetworkView.tsx
│   │   ├── inventory/         # Stock logging, threshold alerts, and reorder levels
│   │   │   └── ProductManagement.tsx
│   │   ├── layouts/           # Role-based shell layouts and side navigations
│   │   │   ├── DealerLayout.tsx
│   │   │   ├── EnterpriseLayout.tsx
│   │   │   ├── InfluencerLayout.tsx
│   │   │   └── PartnerLayout.tsx
│   │   ├── orders/            # Order fulfillment, dispatch pipelines, status workflows
│   │   │   └── OrdersManagement.tsx
│   │   ├── profile/           # Enterprise, Dealer, and Partner profile hubs
│   │   │   ├── DealerProfile.tsx
│   │   │   ├── InfluencerProfile.tsx
│   │   │   └── ProfileView.tsx
│   │   ├── rewards/           # Reward schemes, redemption logs, and tier perks
│   │   │   └── RewardsView.tsx
│   │   ├── ui/                # Reusable design system components
│   │   │   ├── CustomDropdown.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── StatusPillDropdown.tsx
│   │   │   └── Toast.tsx
│   │   └── index.ts           # Unified barrel export file
│   ├── context/
│   │   └── AuthContext.tsx    # Role authorization, session, and user profile state
│   ├── lib/
│   │   └── api/               # Typed API client, auth endpoints, and HTTP adapters
│   ├── services/
│   │   └── dataService.ts     # Persistence layer with reactive state and fallback sync
│   ├── App.tsx                # Master routing and layout switcher
│   ├── data.ts                # Initial mock configurations and schema types
│   ├── index.css              # Global Tailwind styling, theme tokens, and custom scrollbars
│   ├── main.tsx               # Client entrypoint
│   └── utils.ts               # Currency (INR), unit formatting, and date helpers
├── .env.example               # Environment variable templates
├── tsconfig.json              # TypeScript compilation setup with path aliases (@/*)
└── vite.config.ts             # Vite configuration with API bridge plugin
```

---

## 🚀 Key Features

### 1. Multi-Tier Workspaces
- **Distributor Workspace**: Manage master inventory for primary construction materials (Cement: OPC/PPC/PSC, Steel Rebars: Fe550D/Fe500D), monitor low-stock thresholds, review and dispatch wholesale orders from dealers, evaluate dealer credit, and administer reward tiers.
- **Dealer Workspace**: Maintain local retail stock, submit purchase orders directly to regional distributors, dispatch to end-customers, manage contractor ledgers, and redeem accumulated loyalty points.
- **Partner & Contractor Portal**: Track bulk site shipments, manage active site deliveries, view GST invoices, and verify product compliance certificates.
- **Trade Influencer Hub**: Scan QR codes on product batches, log builder recommendations, track earned commissions, and redeem milestone perks.

### 2. Order Fulfillment & Dispatch Pipeline
- Multi-step order progression (`Pending` ➔ `Confirmed` ➔ `Dispatched` ➔ `Delivered` ➔ `Completed`).
- One-click dispatch tracking with integrated logistics details (carrier, vehicle number, dispatch notes).
- Dealer receipt verification workflow with instant inventory replenishment upon marked delivery.

### 3. Dual-Tier Inventory Engine
- Distributor master inventory logs separate from Dealer retail inventories.
- Automatic stock deduction upon dispatch confirmation.
- Real-time stock alerts for low inventory warnings with fast restocking quick-actions.

### 4. Custom Enterprise UI / UX
- Sleek modern dark & slate themed interfaces with Tailwind CSS.
- Consistent custom dropdown components eliminating default browser select aesthetics.
- Subtle, refined micro-scrollbars and high-contrast status pills for enhanced readability.

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **yarn** / **pnpm**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/gtcoders28/SITESYNC.git
   cd SITESYNC
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in any required credentials:
   ```bash
   cp .env.example .env
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

### Production Build
To generate an optimized production bundle:
```bash
npm run build
```
Preview the production build locally:
```bash
npm run preview
```

---

## 🔒 Security & Best Practices
- Never commit active `.env` files or secret keys to version control.
- All database and API secret keys are securely read through environment variables.
- TypeScript strict checking enabled with zero tolerance for unresolved imports.

---

## 📄 License
This project is licensed under the MIT License.
