import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Link2, Paperclip } from 'lucide-react';
import { useActivity } from '../hooks/useActivity';
import { loadReceipts, removeReceipt, StoredReceipt } from '../lib/receiptStore';
import { Button, Card, Notice } from './ui';

type Status = 'loading' | 'pending' | 'viewed' | 'deleted' | 'expired' | 'gone';

const STYLES: Record<Status, string> = {
  loading: 'bg-gray-100 text-gray-500',
  pending: 'bg-amber-100 text-amber-800',
  viewed: 'bg-green-100 text-green-800',
  deleted: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-600',
  gone: 'bg-gray-100 text-gray-500',
};

const ReceiptsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { receipts, refresh, markReceiptsSeen } = useActivity();
  const [items, setItems] = useState<StoredReceipt[]>(loadReceipts);
  // Qué recibos eran novedad al entrar, para resaltarlos aunque ya se marquen como vistos
  const [fresh] = useState(() => new Set(loadReceipts().filter(r => !r.seen).map(r => r.id)));

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Entrar a la vista cuenta como "visto": se apaga el badge
  useEffect(() => {
    markReceiptsSeen();
  }, [markReceiptsSeen]);

  const date = (ms: number) => new Date(ms).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' });

  const remove = (id: string) => {
    removeReceipt(id);
    setItems(loadReceipts());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{t('receipts.title')}</h2>
        <Button variant="secondary" icon={<Link2 className="h-4 w-4" />} onClick={() => navigate('/')}>
          {t('receipts.new')}
        </Button>
      </div>
      <Notice>{t('receipts.explanation')}</Notice>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">{t('receipts.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {items.map(item => {
            const info = receipts[item.id];
            const status: Status = info?.status || 'loading';
            const highlight = fresh.has(item.id) && status === 'viewed';
            return (
              <li key={item.id}>
                <Card className={`space-y-2 ${highlight ? 'border-green-300 ring-1 ring-green-200' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{item.note || t('receipts.untitled')}</p>
                      <p className="flex items-center gap-1 text-xs text-gray-500">
                        {t('receipts.created', { date: date(item.createdAt) })}
                        {item.files > 0 && (
                          <>
                            {' · '}
                            <Paperclip className="h-3 w-3" aria-hidden /> {item.files}
                          </>
                        )}
                      </p>
                    </div>
                    <span className={`inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
                      {t(`receipts.status.${status}`)}
                    </span>
                  </div>
                  {status === 'viewed' && info?.at && (
                    <p className="text-sm font-medium text-green-800">{t('receipts.viewedAt', { date: date(info.at * 1000) })}</p>
                  )}
                  {status === 'deleted' && info?.at && <p className="text-sm text-gray-600">{t('receipts.deletedAt', { date: date(info.at * 1000) })}</p>}
                  <div className="flex justify-end">
                    <Button variant="ghost" className="!min-h-[36px] !px-3 !py-1.5" onClick={() => remove(item.id)}>
                      {t('receipts.forget')}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ReceiptsPage;
