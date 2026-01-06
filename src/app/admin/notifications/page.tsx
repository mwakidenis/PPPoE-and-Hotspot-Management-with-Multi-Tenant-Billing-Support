'use client';

import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, Loader2 } from 'lucide-react';
import { formatWIB } from '@/lib/timezone';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const url = filter === 'unread' 
        ? '/api/notifications?unreadOnly=true&limit=100'
        : '/api/notifications?limit=100';
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Load notifications error:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationIds: string[]) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
      });
      loadNotifications();
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      loadNotifications();
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
      });
      loadNotifications();
    } catch (error) {
      console.error('Delete notification error:', error);
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'invoice_overdue':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/10';
      case 'new_registration':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10';
      case 'payment_received':
        return 'border-l-green-500 bg-green-50 dark:bg-green-900/10';
      case 'user_expired':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
      case 'system_alert':
        return 'border-l-purple-500 bg-purple-50 dark:bg-purple-900/10';
      default:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/10';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'invoice_overdue':
        return '💸';
      case 'new_registration':
        return '👤';
      case 'payment_received':
        return '✅';
      case 'user_expired':
        return '⏰';
      case 'system_alert':
        return '⚠️';
      default:
        return '📢';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Notifications
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          View and manage all your notifications
        </p>
      </div>

      {/* Stats & Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold">{notifications.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unread</p>
              <p className="text-2xl font-bold text-blue-600">{unreadCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm rounded-lg transition ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 text-sm rounded-lg transition ${
                  filter === 'unread'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Unread
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition"
              >
                <CheckCheck className="w-4 h-4" />
                Mark All as Read
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Bell className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No notifications</p>
            <p className="text-sm mt-1">
              {filter === 'unread' ? 'All caught up!' : 'You have no notifications yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-6 border-l-4 transition-colors ${getNotificationColor(
                  notif.type
                )} ${!notif.isRead ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{getNotificationIcon(notif.type)}</div>
                  
                  <div className="flex-1 min-w-0">
                    {notif.link ? (
                      <Link
                        href={notif.link}
                        onClick={() => {
                          if (!notif.isRead) {
                            markAsRead([notif.id]);
                          }
                        }}
                        className="block group"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          {notif.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {notif.message}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          {formatWIB(notif.createdAt, 'dd MMM yyyy HH:mm:ss')}
                        </p>
                      </Link>
                    ) : (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {notif.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {notif.message}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          {formatWIB(notif.createdAt, 'dd MMM yyyy HH:mm:ss')}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!notif.isRead && (
                      <button
                        onClick={() => markAsRead([notif.id])}
                        className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition"
                        title="Mark as read"
                      >
                        <Check className="w-5 h-5 text-blue-600" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
