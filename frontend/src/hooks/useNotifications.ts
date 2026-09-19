import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { NotificationItem } from '../components/NotificationContainer';

type NotificationType = NotificationItem['type'];

interface NotificationsApi {
  notifications: NotificationItem[];
  addNotification: (type: NotificationType, message: string, duration?: number) => void;
  removeNotification: (id: string) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const NotificationsContext = createContext<NotificationsApi | null>(null);

// Un único estado compartido: antes cada pestaña tenía el suyo y sus avisos nunca se mostraban
export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const addNotification = useCallback((type: NotificationType, message: string, duration?: number) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    // Evita apilar el mismo aviso repetido
    setNotifications(prev =>
      prev.some(n => n.message === message && n.type === type)
        ? prev
        : [...prev.slice(-3), { id, type, message, duration }]
    );
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Funciones estables: se pueden usar como dependencias de efectos
  const actions = useMemo(() => ({
    addNotification,
    removeNotification,
    showSuccess: (m: string, d?: number) => addNotification('success', m, d),
    showError: (m: string, d?: number) => addNotification('error', m, d),
    showWarning: (m: string, d?: number) => addNotification('warning', m, d),
    showInfo: (m: string, d?: number) => addNotification('info', m, d),
  }), [addNotification, removeNotification]);

  const api = useMemo<NotificationsApi>(() => ({ notifications, ...actions }), [notifications, actions]);

  return React.createElement(NotificationsContext.Provider, { value: api }, children);
};

export const useNotifications = (): NotificationsApi => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications requiere NotificationsProvider');
  return ctx;
};
