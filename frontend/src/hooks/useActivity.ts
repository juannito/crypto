import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityResult, getActivity } from '../lib/api';
import { loadReceipts, markReceiptsSeen } from '../lib/receiptStore';
import { loadRequests } from '../lib/requestStore';
import { useNotifications } from './useNotifications';

const POLL_MS = 30000;
const NOTIFIED_KEY = 'crypto.activity.notified.v1';
const MAX_ITEMS = 50;

interface ActivityApi {
  requests: ActivityResult['requests'];
  receipts: ActivityResult['receipts'];
  // Solicitudes respondidas que todavía no se retiraron
  pendingAnswers: number;
  // Mensajes leídos que el usuario aún no vio en Recibos
  unreadReceipts: number;
  refresh: () => void;
  markReceiptsSeen: () => void;
}

const ActivityContext = createContext<ActivityApi | null>(null);

function loadNotified(): string[] {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveNotified(list: string[]) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    // almacenamiento no disponible
  }
}

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const { showSuccess } = useNotifications();
  const [data, setData] = useState<ActivityResult>({ requests: {}, receipts: {} });
  const [version, setVersion] = useState(0);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    const reqs = loadRequests();
    // Se consultan todos para mostrar su estado; solo los aún no vistos generan avisos
    const rcpts = loadReceipts().filter(r => !r.seen);
    const seen = loadReceipts().filter(r => r.seen);
    if (reqs.length === 0 && rcpts.length === 0 && seen.length === 0) {
      setData({ requests: {}, receipts: {} });
      return;
    }
    busy.current = true;
    try {
      const result = await getActivity(
        reqs.slice(0, MAX_ITEMS / 2).map(r => ({ id: r.id, token: r.ownerToken })),
        [...rcpts, ...seen].slice(0, MAX_ITEMS / 2).map(r => ({ id: r.id, token: r.token }))
      );
      setData(result);

      // Avisos una sola vez por evento, aunque se recargue la página
      const notified = loadNotified();
      const fresh: string[] = [];
      reqs.forEach(r => {
        const key = `req:${r.id}`;
        if (result.requests[r.id]?.status === 'answered' && !notified.includes(key)) {
          showSuccess(t('activity.answered', { label: r.label || t('requests.untitled') }), 8000);
          fresh.push(key);
        }
      });
      rcpts.forEach(r => {
        const key = `rcpt:${r.id}`;
        if (result.receipts[r.id]?.status === 'viewed' && !notified.includes(key)) {
          showSuccess(t('activity.read', { note: r.note || t('receipts.untitled') }), 8000);
          fresh.push(key);
        }
      });
      if (fresh.length) saveNotified([...notified, ...fresh]);
    } catch {
      // Sin conexión: se reintenta en la próxima consulta
    } finally {
      busy.current = false;
    }
  }, [showSuccess, t]);

  useEffect(() => {
    refresh();
    // Cada 30 s con la pestaña visible; cada 2 min en segundo plano (para el contador del título)
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      if (document.visibilityState === 'visible' || tick % 4 === 0) refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const pendingAnswers = Object.values(data.requests).filter(r => r.status === 'answered').length;
  const unreadReceipts = useMemo(
    () => loadReceipts().filter(r => !r.seen && ['viewed'].includes(data.receipts[r.id]?.status || '')).length,
    // version: se recalcula al marcar como vistos
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, version]
  );

  // Contador en el título de la pestaña
  useEffect(() => {
    const total = pendingAnswers + unreadReceipts;
    const base = t('appName');
    document.title = total > 0 ? `(${total}) ${base}` : base;
  }, [pendingAnswers, unreadReceipts, t]);

  const markSeen = useCallback(() => {
    const viewed = Object.entries(data.receipts)
      .filter(([, v]) => v.status !== 'pending')
      .map(([id]) => id);
    if (viewed.length) {
      markReceiptsSeen(viewed);
      setVersion(v => v + 1);
    }
  }, [data]);

  const api = useMemo<ActivityApi>(
    () => ({ ...data, pendingAnswers, unreadReceipts, refresh, markReceiptsSeen: markSeen }),
    [data, pendingAnswers, unreadReceipts, refresh, markSeen]
  );

  return React.createElement(ActivityContext.Provider, { value: api }, children);
};

export const useActivity = (): ActivityApi => {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error('useActivity requiere ActivityProvider');
  return ctx;
};
