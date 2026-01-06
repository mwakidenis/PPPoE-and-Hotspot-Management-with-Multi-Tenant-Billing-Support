'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut, SessionProvider } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  Wifi,
  Receipt,
  CreditCard,
  Wallet,
  Clock,
  MessageSquare,
  Network,
  Map,
  Settings,
  Menu,
  X,
  ChevronDown,
  Shield,
  Bell,
  Search,
  Languages,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import NotificationDropdown from '@/components/NotificationDropdown';

interface MenuItem {
  title: string;
  icon: React.ReactNode;
  href?: string;
  children?: { title: string; href: string; badge?: string; requiredPermission?: string }[];
  badge?: string;
  requiredPermission?: string; // Permission key needed to see this menu item
}

const menuItems: MenuItem[] = [
  {
    title: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    href: '/admin',
    requiredPermission: 'dashboard.view',
  },
  {
    title: 'PPPoE',
    icon: <Users className="w-5 h-5" />,
    requiredPermission: 'customers.view',
    children: [
      { title: 'Users', href: '/admin/pppoe/users', requiredPermission: 'customers.view' },
      { title: 'Profiles', href: '/admin/pppoe/profiles', requiredPermission: 'customers.view' },
      { title: 'Registration Requests', href: '/admin/pppoe/registrations', badge: 'pending', requiredPermission: 'registrations.view' },
    ],
  },
  {
    title: 'Hotspot',
    icon: <Wifi className="w-5 h-5" />,
    requiredPermission: 'hotspot.view',
    children: [
      { title: 'Voucher', href: '/admin/hotspot/voucher', requiredPermission: 'vouchers.view' },
      { title: 'Profile', href: '/admin/hotspot/profile', requiredPermission: 'hotspot.view' },
      { title: 'Template', href: '/admin/hotspot/template', requiredPermission: 'hotspot.view' },
      { title: 'Agent', href: '/admin/hotspot/agent', requiredPermission: 'hotspot.view' },
      { title: 'E-Voucher Orders', href: '/admin/hotspot/evoucher', requiredPermission: 'vouchers.view' },
    ],
  },
  {
    title: 'Invoices',
    icon: <Receipt className="w-5 h-5" />,
    href: '/admin/invoices',
    requiredPermission: 'invoices.view',
  },
  {
    title: 'Payment Gateway',
    icon: <CreditCard className="w-5 h-5" />,
    href: '/admin/payment-gateway',
    requiredPermission: 'settings.payment',
  },
  {
    title: 'Keuangan',
    icon: <Wallet className="w-5 h-5" />,
    href: '/admin/keuangan',
    requiredPermission: 'keuangan.view',
  },
  {
    title: 'Sessions',
    icon: <Clock className="w-5 h-5" />,
    href: '/admin/sessions',
    requiredPermission: 'sessions.view',
  },
  {
    title: 'WhatsApp',
    icon: <MessageSquare className="w-5 h-5" />,
    requiredPermission: 'whatsapp.view',
    children: [
      { title: 'Providers', href: '/admin/whatsapp/providers', requiredPermission: 'whatsapp.providers' },
      { title: 'Templates', href: '/admin/whatsapp/templates', requiredPermission: 'whatsapp.templates' },
      { title: 'Notification Settings', href: '/admin/whatsapp/notifications', requiredPermission: 'notifications.manage' },
      { title: 'History', href: '/admin/whatsapp/history', requiredPermission: 'whatsapp.view' },
      { title: 'Send Message', href: '/admin/whatsapp/send', requiredPermission: 'whatsapp.send' },
    ],
  },
  {
    title: 'Network',
    icon: <Network className="w-5 h-5" />,
    requiredPermission: 'network.view',
    children: [
      { title: 'Router / NAS', href: '/admin/network/routers', requiredPermission: 'routers.view' },
      { title: 'VPN Server', href: '/admin/network/vpn-server', requiredPermission: 'vpn.view' },
      { title: 'VPN Clients', href: '/admin/network/vpn-clients', requiredPermission: 'vpn.view' },
    ],
  },
  {
    title: 'Network Map',
    icon: <Map className="w-5 h-5" />,
    requiredPermission: 'network.view',
    children: [
      { title: 'Dashboard', href: '/admin/network-map/dashboard', requiredPermission: 'network.view' },
      { title: 'Management', href: '/admin/network-map/management', requiredPermission: 'network.edit' },
    ],
  },
  {
    title: 'Management',
    icon: <Shield className="w-5 h-5" />,
    href: '/admin/management',
    requiredPermission: 'users.view',
  },
  {
    title: 'Settings',
    icon: <Settings className="w-5 h-5" />,
    requiredPermission: 'settings.view',
    children: [
      { title: 'Company', href: '/admin/settings/company', requiredPermission: 'settings.company' },
      { title: 'Database', href: '/admin/settings/database', requiredPermission: 'settings.view' },
      { title: 'Cron Jobs', href: '/admin/settings/cron', requiredPermission: 'settings.cron' },
      { title: 'GenieACS', href: '/admin/settings/genieacs', requiredPermission: 'settings.genieacs' },
    ],
  },
];

function NavItem({ item, pendingCount }: { item: MenuItem; pendingCount: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors',
            'hover:bg-gray-100 dark:hover:bg-gray-800'
          )}
        >
          <div className="flex items-center gap-3">
            {item.icon}
            <span>{item.title}</span>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform',
              isOpen && 'transform rotate-180'
            )}
          />
        </button>
        {isOpen && (
          <div className="ml-8 mt-1 space-y-1">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'flex items-center justify-between px-4 py-2 text-sm rounded-lg transition-colors',
                  pathname === child.href
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                )}
              >
                <span>{child.title}</span>
                {child.badge === 'pending' && pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                    {pendingCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={cn(
        'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors',
        pathname === item.href
          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      )}
    >
      {item.icon}
      <span>{item.title}</span>
    </Link>
  );
}

function AdminLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [pendingRegistrations, setPendingRegistrations] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const { company, locale, setLocale, setCompany } = useAppStore();
  
  // Check if current page is login
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    setMounted(true);
    setCurrentDate(new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Jakarta',
    }));
    
    // Load user permissions
    if (session?.user) {
      const userId = (session.user as any).id;
      if (userId) {
        fetch(`/api/admin/users/${userId}/permissions`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setUserPermissions(data.permissions);
            }
          })
          .catch((error) => console.error('Error loading permissions:', error));
      }
    }

    // Load company data from database
    fetch('/api/company')
      .then((res) => res.json())
      .then((data) => {
        if (data.name) {
          setCompany({
            name: data.name,
            email: data.email,
            phone: data.phone,
            address: data.address,
            baseUrl: data.baseUrl || window.location.origin,
            adminPhone: data.phone,
          });
        }
      })
      .catch((error) => console.error('Error loading company:', error));

    // Load pending registrations count
    fetch('/api/admin/registrations?status=PENDING')
      .then((res) => res.json())
      .then((data) => {
        if (data.stats) {
          setPendingRegistrations(data.stats.pending || 0);
        }
      })
      .catch((error) => console.error('Error loading pending registrations:', error));

    // Refresh pending count every 30 seconds
    const interval = setInterval(() => {
      fetch('/api/admin/registrations?status=PENDING')
        .then((res) => res.json())
        .then((data) => {
          if (data.stats) {
            setPendingRegistrations(data.stats.pending || 0);
          }
        })
        .catch((error) => console.error('Error refreshing pending registrations:', error));
    }, 30000);

    return () => clearInterval(interval);
  }, [setCompany, session]);

  // If login page, render children only without layout
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-64 bg-white/80 backdrop-blur-xl dark:bg-gray-950/80 border-r border-gray-200/50 dark:border-gray-800/50 transition-transform shadow-xl',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/50 dark:border-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span className="text-white font-bold text-lg">{company.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent truncate">
                  {company.name}
                </h1>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 -mt-1 truncate">Billing System</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {menuItems
              .filter((item) => {
                // Show if no permission required OR user has the permission
                if (!item.requiredPermission) return true;
                return userPermissions.includes(item.requiredPermission);
              })
              .map((item) => {
                // Filter children based on permissions
                const filteredItem = {
                  ...item,
                  children: item.children?.filter((child) => {
                    if (!child.requiredPermission) return true;
                    return userPermissions.includes(child.requiredPermission);
                  }),
                };
                
                // Only show parent if it has visible children (or no children)
                if (filteredItem.children && filteredItem.children.length === 0) {
                  return null;
                }
                
                return <NavItem key={item.title} item={filteredItem} pendingCount={pendingRegistrations} />;
              })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-gray-50/50 to-transparent dark:from-gray-900/50">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors group"
              >
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                    {session?.user?.name?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-950 rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {session?.user?.name || 'Admin User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {(session?.user as any)?.username || 'admin'}
                  </p>
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-all",
                  showUserMenu && "rotate-180"
                )} />
              </button>
              
              {showUserMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {(session?.user as any)?.username}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {(session?.user as any)?.role}
                    </p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/admin/login' })}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl dark:bg-gray-950/80 border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm">
          <div className="flex items-center gap-4 px-6 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Search bar */}
            <div className="hidden md:flex flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-100/50 dark:bg-gray-900/50 border border-transparent hover:border-gray-300 dark:hover:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
            
            <div className="flex-1" />
            
            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {mounted && currentDate && (
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-100/50 dark:bg-gray-900/50 rounded-lg border border-gray-200/50 dark:border-gray-800/50">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {currentDate}
                  </span>
                </div>
              )}
              
              <NotificationDropdown />
              
              <button
                onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                title="Switch language"
              >
                <Languages className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                  {locale}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </SessionProvider>
  );
}
