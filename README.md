# Mother's Kitchen — Super Admin Web Portal

A society-based homemade food delivery management portal built with **React 19**, **Vite**, **TanStack Router**, **Tailwind CSS v4**, **Radix UI**, **Recharts**, **SheetJS (xlsx)**, and **Firebase**.

---

## 🍽️ Key Modules Implemented

1. **Dashboard (`/super-admin`)**
   - KPI metric cards for Total Societies (24), Total Chefs (38), Total Customers (1,254), Total Orders (864), and Revenue (₹64,320).
   - Top performing societies and quick access shortcuts to operational actions.

2. **Society Management (`/super-admin/society`)**
   - View all registered societies with City, Area, Wings count, and Total Floors.
   - Live Enabled / Disabled toggle switch per society (disabling immediately alerts customer app to show *"The services are temporary unavailabled in your society"*).
   - Add/Edit Society modal with multi-tiered hierarchy: City → Area → Society Name → Number of Wings → Floors per wing.
   - Duplicate prevention checks and deletion protection.

3. **Chef Management (`/super-admin/chefs`)**
   - Register cooks with Full Name, Email, Mobile Number, Photograph, ID card number, and residential address.
   - Allocate deliverable societies multi-select from approved societies directory.
   - Separate administrator-assigned deliverable societies from chef's daily availability.
   - Live Enabled / Disabled toggle (disabled chefs are blocked from logging into the Chef Mobile App).
   - Secure provisioning workflow designed for backend execution.

4. **Customer App Highlights (`/super-admin/highlights`)**
   - Exactly 4 promotional banner image slots matching the customer home carousel.
   - Image upload, format validation (PNG, JPG, WebP up to 5MB), dimension guidelines (1080x540 px), title/subtitle editing, and active toggles.
   - Integrated mobile carousel preview modal.

5. **Customer Database (`/super-admin/customers`)**
   - Filterable customer table by City, Area, and Society.
   - Fast full-text search across customer name, mobile, and address.
   - Pagination controls.
   - **SheetJS Genuine Excel (`.xlsx`) Export**: Exports only the rows matching active filters with auto-calculated column widths.

6. **Statistics and Reports (`/super-admin/reports`)**
   - Date range selector: `Today`, `Yesterday`, `This Week`, `This Month` (01 Oct – 31 Oct), and `Custom Date` range.
   - Timezone-safe calculations aligned with `Asia/Kolkata`.
   - Recharts Visualizations:
     - Orders & Revenue Trend dual-area chart.
     - Order Distribution by Society donut chart.
   - Breakdown tables: Chef/Customer count per society & Orders/Revenue per society.

7. **WhatsApp Marketing (`/super-admin/marketing`)**
   - Filter target customers by City, Area, and Society with multi-select checkboxes.
   - WhatsApp message composer with character counter and optional promotional image attachment.
   - Live WhatsApp mobile preview bubble with timestamp, formatting, and verified green ticks.
   - Campaign history table with customer reach and delivery status.

---

## 🚀 Running the Project Locally

```bash
# 1. Install dependencies
npm install

# 2. Start Vite local development server
npm run dev

# 3. Build production bundle
npm run build

# 4. Preview production build locally
npm run preview
```

The portal runs out of the box in **Demo Mode** with realistic seed data matching the 24-page BRD when Firebase credentials are not yet supplied.

---

## 🔑 Connecting Mother's Kitchen Dedicated Firebase Project

When your Mother's Kitchen Firebase project is registered:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your dedicated Firebase Web App credentials:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=mothers-kitchen-xxxx.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=mothers-kitchen-xxxx
   VITE_FIREBASE_STORAGE_BUCKET=mothers-kitchen-xxxx.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=1:...:web:...
   VITE_FIREBASE_MEASUREMENT_ID=G-...
   ```

3. Restart the Vite dev server (`npm run dev`). The portal automatically transitions from Demo Mode to Live Firestore & Firebase Auth mode.

---

## 🛡️ Authoritative Super Admin Provisioning

Never assign admin permissions via client-side storage. Use the trusted server-side script:

```bash
# Set your Firebase Service Account key and execute provisioning:
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json"
node scripts/provision-super-admin.mjs admin@motherskitchen.com
```

This assigns `{ role: "super-admin", admin: true }` custom claims directly on the user's Firebase Authentication token.

---

## ⚡ Cloud Functions Backend (`functions/`)

The backend functions implement:
1. `provisionChef`: Secure HTTPS endpoint for Super Admin to create cook authentication accounts without signing out.
2. `nightlyChefResetCron`: Cloud Scheduler cron running at **midnight 12:00 AM (Asia/Kolkata)** to reset chef active status (`isDailyActive = false`) and reset food availability (`isAvailable = false`).
3. `onOrderPlacedTrigger`: Firestore trigger on new order documents to send confirmation WhatsApp messages with chef contact details.
4. `dispatchCampaign`: Super Admin HTTPS endpoint to dispatch promotional messages via the Meta WhatsApp Cloud API.

### Deploying Security Rules & Functions
```bash
# Deploy Firestore & Storage rules
firebase deploy --only firestore:rules,storage

# Deploy Cloud Functions
firebase deploy --only functions
```
