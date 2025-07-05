import { useState, useCallback } from 'react';
import { NotificationItem } from '../components/NotificationContainer';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const addNotification = useCallback((
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    duration?: number
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newNotification: NotificationItem = {
      id,
      type,
      message,
      duration
    };

    setNotifications(prev => [...prev, newNotification]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    addNotification('success', message, duration);
  }, [addNotification]);

  const showError = useCallback((message: string, duration?: number) => {
    addNotification('error', message, duration);
  }, [addNotification]);

  const showWarning = useCallback((message: string, duration?: number) => {
    addNotification('warning', message, duration);
  }, [addNotification]);

  const showInfo = useCallback((message: string, duration?: number) => {
    addNotification('info', message, duration);
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
}; 