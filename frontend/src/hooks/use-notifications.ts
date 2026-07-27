import { createContext, useContext } from 'react';
import type { AppNotification } from '@/lib/notifications';

export interface NotificationItem extends AppNotification {
  isRead: boolean;
}

export interface NotificationContextValue {
  /** Every current notification for the selected department, newest concern first. */
  items: NotificationItem[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
