import React, { useEffect, useState, useCallback } from 'react';

interface NotificationProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onRemove: (id: string) => void;
}

const Notification: React.FC<NotificationProps> = ({ id, type, message, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);

  const handleClose = useCallback(() => {
    setIsHiding(true);
    setTimeout(() => {
      onRemove(id);
    }, 300);
  }, [onRemove, id]);

  useEffect(() => {
    // Mostrar la notificación con animación
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    // Auto-ocultar después de 5 segundos
    const hideTimer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [handleClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  const getNotificationClasses = () => {
    const baseClasses = 'notification';
    const typeClasses = `notification-${type}`;
    const visibilityClasses = isVisible && !isHiding ? 'show' : 'hide';
    
    return `${baseClasses} ${typeClasses} ${visibilityClasses}`;
  };

  return (
    <div className={getNotificationClasses()}>
      <div className="notification-content">
        <span className="notification-icon">{getIcon()}</span>
        <span className="notification-message">{message}</span>
        <button
          type="button"
          className="notification-close"
          onClick={handleClose}
          aria-label="Cerrar notificación"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Notification; 