import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Lock, QrCode } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { seal } from '../crypto/envelope';
import { encodePayload } from '../crypto/payload';
import { apiErrorKey } from '../lib/api';
import { formatLocalCiphertext } from '../lib/links';
import Composer, { contentError, MIN_PASSWORD_LENGTH } from './Composer';
import Modal from './Modal';
import { Button, Card, CopyButton, Notice, PasswordField, QrBlock } from './ui';

const QR_MAX_CHARS = 1800;

const EncryptTab: React.FC = () => {
  const { t } = useTranslation();
  const { showError, showSuccess } = useNotifications();
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [password, setPassword] = useState('');
  const [encrypted, setEncrypted] = useState('');
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setMessage('');
    setFiles([]);
    setPassword('');
    setEncrypted('');
    setResetKey(k => k + 1);
  };

  const handleEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = contentError(message, files);
    if (error) return showError(t(error));
    if (password.length < MIN_PASSWORD_LENGTH) return showError(t('notifications.warning.keyTooShort'));

    setBusy(true);
    try {
      const envelope = await seal(await encodePayload(message.trim(), files), { password });
      setEncrypted(formatLocalCiphertext(envelope));
      showSuccess(t('notifications.success.messageEncrypted'));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err) {
      showError(t(apiErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const downloadCode = () => {
    const url = URL.createObjectURL(new Blob([encrypted], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mensaje-cifrado.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const qrAllowed = encrypted.length < QR_MAX_CHARS;

  return (
    <form className="space-y-4" onSubmit={handleEncrypt}>
      <Composer key={resetKey} message={message} onMessageChange={v => { setMessage(v); setEncrypted(''); }} onFilesChange={setFiles} disabled={busy} />

      <Card>
        <PasswordField
          label={t('encrypt.passwordLabel')}
          placeholder={t('form.secretKey')}
          hint={t('encrypt.passwordHint')}
          value={password}
          onChange={v => {
            setPassword(v);
            setEncrypted('');
          }}
          showStrength
          disabled={busy}
        />
      </Card>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Button type="submit" loading={busy} icon={<Lock className="h-4 w-4" />} block>
          {busy ? t('form.encrypting') : t('form.encrypt')}
        </Button>
        <Button variant="secondary" onClick={reset} disabled={busy}>
          {t('form.clear')}
        </Button>
      </div>

      <Notice>{t('encrypt.note')}</Notice>

      {encrypted && (
        <div ref={resultRef} className="scroll-mt-4">
          <Card className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('encryptedMessage')}</h3>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-800">
              {encrypted}
            </pre>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <CopyButton text={encrypted} block />
              <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={downloadCode} block>
                {t('encrypt.download')}
              </Button>
              <Button
                variant="secondary"
                icon={<QrCode className="h-4 w-4" />}
                onClick={() => setShowQr(true)}
                disabled={!qrAllowed}
                title={qrAllowed ? undefined : t('encrypt.qrTooLarge')}
                block
              >
                {t('form.showQR')}
              </Button>
            </div>
            {!qrAllowed && <p className="text-xs text-gray-500">{t('encrypt.qrTooLarge')}</p>}
          </Card>
        </div>
      )}

      {showQr && (
        <Modal title={t('encryptedMessage')} onClose={() => setShowQr(false)}>
          <QrBlock value={encrypted} size={240} caption={t('encrypt.qrCaption')} />
        </Modal>
      )}
    </form>
  );
};

export default EncryptTab;
