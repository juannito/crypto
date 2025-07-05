import React from 'react';
import Notification from './Notification';

export interface NotificationItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface NotificationContainerProps {
  notifications: NotificationItem[];
  onRemoveNotification: (id: string) => void;
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onRemoveNotification
}) => {
  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          id={notification.id}
          type={notification.type}
          message={notification.message}
          onRemove={onRemoveNotification}
        />
      ))}
    </div>
  );
};

export default NotificationContainer; 