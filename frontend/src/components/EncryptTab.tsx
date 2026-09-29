import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Link2, Lock, QrCode } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { accessToken, LINK_KEY_LEN, randomBytes, seal } from '../crypto/envelope';
import { encodePayload } from '../crypto/payload';
import { apiErrorKey, createShare } from '../lib/api';
import { buildShareLink, formatLocalCiphertext } from '../lib/links';
import Composer, { contentError, MIN_PASSWORD_LENGTH } from './Composer';
import Modal from './Modal';
import { Button, Card, CopyButton, Field, inputClass, LinkBox, Notice, PasswordField, QrBlock, Toggle, useExpireOptions } from './ui';

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
  // Código demasiado largo para un QR: se sube cifrado y el QR lleva solo el enlace
  const expireOptions = useExpireOptions();
  const [showLinkQr, setShowLinkQr] = useState(false);
  const [expire, setExpire] = useState('604800');
  const [destroy, setDestroy] = useState(true);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setMessage('');
    setFiles([]);
    setPassword('');
    clearResult();
    setResetKey(k => k + 1);
  };

  // Cualquier cambio en el contenido invalida el código y el enlace
  const clearResult = () => {
    setEncrypted('');
    setLinkUrl('');
  };

  const handleEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = contentError(message, files);
    if (error) return showError(t(error));
    if (password.length < MIN_PASSWORD_LENGTH) return showError(t('notifications.warning.keyTooShort'));

    setBusy(true);
    try {
      const envelope = await seal(await encodePayload(message.trim(), files), { password });
      setLinkUrl('');
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

  const createLink = async () => {
    setLinkBusy(true);
    try {
      // El servidor exige clave de enlace; la contraseña sigue siendo obligatoria para abrirlo
      const linkKey = randomBytes(LINK_KEY_LEN);
      const envelope = await seal(await encodePayload(message.trim(), files), { linkKey, password });
      const { id } = await createShare(envelope, expire, destroy, await accessToken(linkKey));
      setLinkUrl(buildShareLink(id, linkKey));
    } catch (err) {
      showError(t(apiErrorKey(err)));
    } finally {
      setLinkBusy(false);
    }
  };

  const qrAllowed = encrypted.length < QR_MAX_CHARS;

  return (
    <form className="space-y-4" onSubmit={handleEncrypt}>
      <Composer key={resetKey} message={message} onMessageChange={v => { setMessage(v); clearResult(); }} onFilesChange={f => { setFiles(f); clearResult(); }} disabled={busy} />

      <Card>
        <PasswordField
          label={t('encrypt.passwordLabel')}
          placeholder={t('form.secretKey')}
          hint={t('encrypt.passwordHint')}
          value={password}
          onChange={v => {
            setPassword(v);
            clearResult();
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
                onClick={() => (qrAllowed ? setShowQr(true) : setShowLinkQr(true))}
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

      {showLinkQr && (
        <Modal
          title={t('encrypt.linkTitle')}
          onClose={() => setShowLinkQr(false)}
          footer={
            !linkUrl && (
              <Button onClick={createLink} loading={linkBusy} icon={<Link2 className="h-4 w-4" />} block>
                {t('encrypt.linkCreate')}
              </Button>
            )
          }
        >
          {linkUrl ? (
            <div className="space-y-3">
              <LinkBox url={linkUrl} qrCaption={t('encrypt.linkQrCaption')} qrOpen />
              <Notice>{t('encrypt.linkPasswordReminder')}</Notice>
            </div>
          ) : (
            <div className="space-y-3">
              <Notice tone="warning">{t('encrypt.linkWarning')}</Notice>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('form.expires')} htmlFor="encrypt-link-expire">
                  <select id="encrypt-link-expire" className={inputClass} value={expire} onChange={e => setExpire(e.target.value)} disabled={linkBusy}>
                    {expireOptions.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:pt-6">
                  <Toggle checked={destroy} onChange={setDestroy} label={t('form.destroyOnRead')} description={t('share.destroyHint')} disabled={linkBusy} />
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </form>
  );
};

export default EncryptTab;
