import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  expiresAt: number; // epoch en segundos
  onExpire?: () => void;
}

export function formatDuration(seconds: number, t: (k: string, o?: any) => string): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const clock = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return days > 0 ? `${t('countdown.days', { count: days })}, ${clock}` : clock;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ expiresAt, onExpire }) => {
  const { t } = useTranslation();
  const remaining = () => Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  const [left, setLeft] = useState(remaining);
  const total = useRef(Math.max(1, remaining()));
  const expired = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const value = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
      setLeft(value);
      if (value === 0 && !expired.current) {
        expired.current = true;
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  const progress = 100 - (left / total.current) * 100;
  const color = progress > 80 ? 'bg-red-500' : progress > 60 ? 'bg-orange-500' : progress > 40 ? 'bg-amber-400' : 'bg-green-500';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-700">
        <Clock className="h-4 w-4 text-gray-400" aria-hidden />
        <span>
          {t('countdown.expiresIn')}: <span className="font-mono font-semibold tabular-nums">{formatDuration(left, t)}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full transition-all duration-1000 ease-linear ${color}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default CountdownTimer;
