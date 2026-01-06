# AIBILL RADIUS - Billing System for RTRW.NET

Modern, full-stack billing system for RTRW.NET ISP with proper WIB (Western Indonesia Time) timezone handling.

## 🎯 Key Features

- ✅ **Proper WIB Timezone Handling** - All dates stored in UTC, displayed in WIB
- 🎨 **Premium UI** - Mobile-first responsive design with dark mode
- ⚡ **Modern Stack** - Next.js 15, TypeScript, Tailwind CSS, Prisma
- 🔐 **Secure** - Built-in authentication structure
- 📱 **SPA Experience** - Fast, smooth navigation without page reloads

## 🚀 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: MySQL with Prisma ORM
- **Icons**: Lucide React
- **Date Handling**: date-fns with timezone support

## 📋 Features Overview

### Admin Panel Modules

1. **Dashboard** - Overview with stats and real-time data
2. **PPPoE Management** - Users and profiles
3. **Hotspot Management** - Vouchers, profiles, and templates
4. **Agent Management** - Reseller accounts
5. **Invoices** - Billing and payment tracking
6. **Payment Gateway** - Multiple payment methods
7. **Keuangan** - Financial reporting
8. **Sessions** - Active connections monitoring
9. **WhatsApp Integration** - Automated notifications
10. **Network Management** - Router/NAS configuration
11. **Network Map** - Visual network topology
12. **Settings** - Company profile, cron jobs, GenieACS

## 🕐 Timezone Handling (The Critical Fix)

This project solves the **UTC vs WIB timezone issue** that causes billing problems:

### How It Works:

1. **Database Storage (UTC)**
   - All dates stored in MySQL as UTC
   - Prisma handles UTC storage automatically

2. **Display (WIB)**
   - Frontend converts UTC to WIB using `date-fns-tz`
   - Functions in `src/lib/timezone.ts`:
     - `toWIB()` - Convert UTC to WIB for display
     - `toUTC()` - Convert WIB to UTC for storage
     - `formatWIB()` - Format dates in WIB
     - `isExpired()` - Check expiry in WIB context

3. **Environment Configuration**
   ```bash
   TZ="Asia/Jakarta"
   NEXT_PUBLIC_TIMEZONE="Asia/Jakarta"
   ```

### Example Usage:

```typescript
import { formatWIB, isExpired, toUTC } from '@/lib/timezone';

// Display date in WIB
const displayDate = formatWIB(user.createdAt, 'dd/MM/yyyy HH:mm');

// Check if expired (in WIB)
const expired = isExpired(user.expiredAt);

// Convert user input to UTC before saving
const utcDate = toUTC(userInputDate);
await prisma.user.create({ data: { expiredAt: utcDate } });
```

## 🛠️ Setup Instructions

### 1. Database Setup

Create MySQL database:
```bash
mysql -u root -p
CREATE DATABASE aibill_radius;
exit;
```

### 2. Environment Configuration

Update `.env` with your database credentials:
```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/aibill_radius?connection_limit=10&pool_timeout=20"
TZ="Asia/Jakarta"
NEXT_PUBLIC_TIMEZONE="Asia/Jakarta"
```

### 3. Install Dependencies & Setup Database

```bash
npm install
npx prisma generate
npx prisma db push
```

### 4. FreeRADIUS Integration Setup

**Important**: This app integrates with FreeRADIUS and automatically restarts it when router/NAS configuration changes.

#### Setup sudoers permission:

```bash
# Run automated setup script
bash scripts/setup-sudoers.sh

# Or manually:
sudo visudo -f /etc/sudoers.d/freeradius-restart
```

Add this line (replace `gnetid` with your PM2 user):
```
gnetid ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart freeradius
gnetid ALL=(ALL) NOPASSWD: /usr/bin/systemctl status freeradius
```

Save and test:
```bash
sudo systemctl restart freeradius
```

If no password is asked, setup is successful! ✅

See [SUDOERS_SETUP.md](SUDOERS_SETUP.md) for detailed instructions.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) - automatically redirects to `/admin`

### 6. Production Deployment with PM2

```bash
# Build the app
npm run build

# Start with PM2
pm2 start npm --name "aibill-radius" -- start

# Or use ecosystem file (recommended)
pm2 start ecosystem.config.js
```

## 📁 Project Structure

```
src/
├── app/
│   ├── admin/              # Admin panel routes
│   │   ├── layout.tsx      # Admin layout with sidebar
│   │   ├── page.tsx        # Dashboard
│   │   ├── pppoe/          # PPPoE management
│   │   ├── hotspot/        # Hotspot management
│   │   └── ...             # Other modules
│   └── page.tsx            # Root (redirects to /admin)
├── lib/
│   ├── timezone.ts         # WIB timezone utilities ⭐
│   └── utils.ts            # General utilities
└── prisma/
    └── schema.prisma       # Database schema
```

## 🎨 UI Components

- **Sidebar Navigation** - Collapsible, mobile-responsive
- **Stats Cards** - Real-time metrics display
- **Data Tables** - Sortable, filterable tables
- **Forms** - With validation and error handling
- **Modals** - For CRUD operations
- **Dark Mode** - Full dark mode support

## 🔒 Security

- Environment variables for sensitive data
- Password hashing with bcryptjs
- SQL injection prevention via Prisma
- XSS protection built into Next.js

## 📊 Database Models

Core models included:
- Users (Admin, Agent, User roles)
- PPPoE Users & Profiles
- Hotspot Vouchers & Profiles
- Sessions (RADIUS accounting)
- Invoices & Payments
- Payment Gateways
- Routers/NAS
- WhatsApp Providers & Templates
- Company Settings

## 🚧 TODO

- [ ] Implement authentication (NextAuth.js)
- [ ] Add API routes for CRUD operations
- [ ] Integrate with RADIUS server
- [ ] Connect payment gateways (Midtrans, Xendit)
- [ ] WhatsApp API integration
- [ ] MikroTik API integration
- [ ] GenieACS integration for TR-069
- [ ] Add charts and analytics
- [ ] Export reports (PDF, Excel)
- [ ] Multi-language support

## 🐛 Debugging Timezone Issues

If you experience timezone issues:

1. **Check environment variables**:
   ```bash
   echo $TZ
   # Should output: Asia/Jakarta
   ```

2. **Verify in code**:
   ```typescript
   import { getTimezoneInfo } from '@/lib/timezone';
   console.log(getTimezoneInfo()); // Should show WIB info
   ```

3. **Check database timezone**:
   ```sql
   SELECT @@global.time_zone, @@session.time_zone;
   ```

## 📝 License

Private - Proprietary software for AIBILL RADIUS

## 👨‍💻 Development

Built with ❤️ for Indonesian ISPs with proper timezone handling.

**Critical Note**: Always use `formatWIB()` and `toWIB()` functions when displaying dates to users. Never display raw UTC dates from database.
