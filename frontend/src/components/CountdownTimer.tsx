import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ConfettiExplosion from 'react-confetti-explosion';

interface CountdownTimerProps {
  seconds: number;
  onExpire: () => void;
  isVisible: boolean;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ seconds, onExpire, isVisible }) => {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    if (!isVisible || seconds <= 0) {
      setTimeLeft(seconds);
      return;
    }

    setTimeLeft(seconds);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds, isVisible, onExpire]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}, ${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    return ((seconds - timeLeft) / seconds) * 100;
  };

  const getProgressColor = (): string => {
    const percentage = getProgressPercentage();
    if (percentage > 80) return 'bg-red-500';
    if (percentage > 60) return 'bg-orange-500';
    if (percentage > 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (!isVisible || seconds <= 0) {
    return null;
  }

  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-blue-800">
          {t('countdown.expiresIn')}: {formatTime(timeLeft)}
        </span>
        <span className="text-xs text-blue-600">
          {timeLeft <= 30 ? '⚠️' : '⏰'}
        </span>
      </div>
      {/* Barra de progreso visual */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-1000 ease-linear ${getProgressColor()}`}
          style={{ width: `${getProgressPercentage()}%` }}
        />
      </div>
    </div>
  );
};

export default CountdownTimer; 