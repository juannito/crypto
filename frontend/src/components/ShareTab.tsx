import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useActivity } from '../hooks/useActivity';
import { bytesToBase64Url } from '../crypto/encoding';
import { addReceipt } from '../lib/receiptStore';
import { accessToken, LINK_KEY_LEN, randomBytes, seal } from '../crypto/envelope';
import { encodePayload } from '../crypto/payload';
import { apiErrorKey, createShare } from '../lib/api';
import { buildShareLink } from '../lib/links';
import Composer, { contentError, MIN_PASSWORD_LENGTH } from './Composer';
import Modal from './Modal';
import { Button, Card, Field, inputClass, LinkBox, Notice, PasswordField, Toggle, useExpireOptions } from './ui';

interface Result {
  url: string;
  destroy: boolean;
  protected: boolean;
  receipt: boolean;
}

const ShareTab: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotifications();
  const expireOptions = useExpireOptions();
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [password, setPassword] = useState('');
  const [expire, setExpire] = useState('604800');
  const [destroy, setDestroy] = useState(true);
  const [receipt, setReceipt] = useState(true);
  const [note, setNote] = useState('');
  const { refresh: refreshActivity } = useActivity();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const reset = () => {
    setMessage('');
    setFiles([]);
    setPassword('');
    setNote('');
    setResetKey(k => k + 1);
  };

  const passwordError = password && password.length < MIN_PASSWORD_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = contentError(message, files);
    if (error) return showError(t(error));
    if (passwordError) return showError(t('notifications.warning.keyTooShort'));

    setBusy(true);
    try {
      const linkKey = randomBytes(LINK_KEY_LEN);
      const envelope = await seal(await encodePayload(message.trim(), files), { linkKey, password: password || undefined });
      // Recibo de lectura: token aleatorio que solo queda en este navegador
      const receiptToken = receipt ? bytesToBase64Url(randomBytes(32)) : undefined;
      const { id, expires_at } = await createShare(envelope, expire, destroy, await accessToken(linkKey), receiptToken);
      if (receiptToken) {
        addReceipt({ id, token: receiptToken, note: note.trim(), createdAt: Date.now(), expiresAt: expires_at, files: files.length, seen: false });
        refreshActivity();
      }
      setResult({ url: buildShareLink(id, linkKey), destroy, protected: !!password, receipt: !!receiptToken });
      showSuccess(t('notifications.success.messageSaved'));
      reset();
    } catch (err) {
      showError(t(apiErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Composer key={resetKey} message={message} onMessageChange={setMessage} onFilesChange={setFiles} disabled={busy} />

        <Card className="space-y-4">
          <PasswordField
            label={t('share.passwordLabel')}
            placeholder={t('share.passwordPlaceholder')}
            hint={t('share.passwordHint')}
            value={password}
            onChange={setPassword}
            showStrength
            disabled={busy}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('form.expires')} htmlFor="share-expire">
              <select id="share-expire" className={inputClass} value={expire} onChange={e => setExpire(e.target.value)} disabled={busy}>
                {expireOptions.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:pt-6">
              <Toggle checked={destroy} onChange={setDestroy} label={t('form.destroyOnRead')} description={t('share.destroyHint')} disabled={busy} />
            </div>
          </div>
          <Toggle checked={receipt} onChange={setReceipt} label={t('share.receiptLabel')} description={t('share.receiptHint')} disabled={busy} />
          {receipt && (
            <Field label={t('share.noteLabel')} htmlFor="share-note" hint={t('share.noteHint')}>
              <input
                id="share-note"
                className={inputClass}
                placeholder={t('share.notePlaceholder')}
                value={note}
                maxLength={80}
                onChange={e => setNote(e.target.value)}
                disabled={busy}
              />
            </Field>
          )}
        </Card>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Button type="submit" loading={busy} icon={<Link2 className="h-4 w-4" />} block>
            {busy ? t('form.encrypting') : t('form.save')}
          </Button>
          <Button variant="secondary" onClick={reset} disabled={busy}>
            {t('form.clear')}
          </Button>
        </div>

        <Notice>{t('share.note')}</Notice>
      </form>

      {result && (
        <Modal
          title={t('modal.messageSaved')}
          onClose={() => setResult(null)}
          footer={
            <div className={`grid gap-3 ${result.destroy ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {!result.destroy && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const url = new URL(result.url);
                    setResult(null);
                    navigate(url.pathname + url.hash);
                  }}
                >
                  {t('modal.preview')}
                </Button>
              )}
              <Button variant="primary" onClick={() => setResult(null)}>
                {t('modal.close')}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <LinkBox url={result.url} copyLabel={t('response.copyUrl')} qrCaption={t('response.scanWithPhone')} qrOpen />
            <Notice tone="warning">{t('share.linkWarning')}</Notice>
            {result.protected && <Notice>{t('share.passwordReminder')}</Notice>}
            {result.destroy && <Notice>{t('share.destroyReminder')}</Notice>}
            {result.receipt && <Notice tone="success">{t('share.receiptReminder')}</Notice>}
          </div>
        </Modal>
      )}
    </>
  );
};

export default ShareTab;
