import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, Link2, Lock, Trash2, Unlock } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { accessToken, DecryptError, open } from '../crypto/envelope';
import { decodePayload, DecryptedPayload } from '../crypto/payload';
import { decryptLegacyShare, decryptLegacyText } from '../crypto/legacy';
import {
  apiErrorKey,
  ApiError,
  deleteShare,
  fetchLegacyShare,
  fetchShare,
  getMeta,
  LegacyShare,
  reportFailedAttempt,
  ShareMeta,
} from '../lib/api';
import { parseInput, parseLocation, ParsedInput } from '../lib/links';
import { findReceipt } from '../lib/receiptStore';
import CountdownTimer from './CountdownTimer';
import { DecryptedContent, GoneView } from './ResultViews';
import { Button, Card, inputClass, Notice, PasswordField, Spinner } from './ui';

type Phase = 'input' | 'loading' | 'ready' | 'decrypting' | 'decrypted' | 'gone';
type GoneReason = 'notFound' | 'deleted' | 'attempts' | 'expired';

const isRemote = (s: ParsedInput | null) => s?.kind === 'share' || s?.kind === 'legacyShare';

const DecryptTab: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotifications();

  const [text, setText] = useState('');
  const [source, setSource] = useState<ParsedInput | null>(null);
  const [fromLink, setFromLink] = useState(false);
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [gone, setGone] = useState<GoneReason | null>(null);
  const [result, setResult] = useState<DecryptedPayload | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [burned, setBurned] = useState(false);

  // Texto cifrado ya descargado: permite reintentar la contraseña sin volver a pedirlo
  const cache = useRef<{ envelope?: Uint8Array; legacy?: LegacyShare }>({});
  const token = useRef<string | undefined>(undefined);

  const finish = useCallback((reason: GoneReason) => {
    cache.current = {};
    setGone(reason);
    setPhase('gone');
  }, []);

  const decrypt = useCallback(
    async (src: ParsedInput, pw: string) => {
      setPhase('decrypting');
      try {
        let payload: DecryptedPayload | null = null;
        if (src.kind === 'local') {
          payload = decodePayload(await open(src.envelope, { password: pw }));
        } else if (src.kind === 'legacyLocal') {
          payload = await decryptLegacyText(src.ciphertext, pw);
        } else if (src.kind === 'share') {
          if (!cache.current.envelope) {
            // Si lo creó este navegador (vista previa), no cuenta como leído
            const share = await fetchShare(src.id, token.current!, findReceipt(src.id)?.token);
            cache.current.envelope = share.envelope;
            setBurned(share.destroyed);
            if (share.expiresAt) setExpiresAt(share.expiresAt);
          }
          payload = decodePayload(await open(cache.current.envelope, { linkKey: src.linkKey, password: pw || undefined }));
        } else {
          if (!cache.current.legacy) {
            const legacy = await fetchLegacyShare(src.id);
            cache.current.legacy = legacy;
            setBurned(legacy.destroyed);
            if (legacy.expires_at) setExpiresAt(legacy.expires_at);
          }
          payload = await decryptLegacyShare(cache.current.legacy.msg, cache.current.legacy.files, pw);
        }
        if (!payload) throw new DecryptError('wrong_key');
        setResult(payload);
        setPhase('decrypted');
        showSuccess(t('notifications.success.messageDecrypted'));
      } catch (err) {
        if (err instanceof DecryptError || (err instanceof Error && err.message === 'malformed_payload')) {
          const remote = src.kind === 'share' || src.kind === 'legacyShare';
          const alreadyBurned = src.kind === 'share' ? false : cache.current.legacy?.destroyed;
          // Si el servidor ya lo borró al leerlo, los reintentos son locales y no descuentan intentos
          if (remote && !alreadyBurned && !(src.kind === 'share' && meta?.destroy)) {
            const left = await reportFailedAttempt(src.id, token.current).catch(() => null);
            if (left === 0) return finish('attempts');
            setAttemptsLeft(left);
          }
          showError(t('notifications.error.wrongKey'));
          setPhase(remote ? 'ready' : 'input');
        } else if (err instanceof ApiError && err.status === 404) {
          finish('notFound');
        } else {
          showError(t(apiErrorKey(err)));
          setPhase(isRemote(src) ? 'ready' : 'input');
        }
      }
    },
    [finish, meta, showError, showSuccess, t]
  );

  const loadRemote = useCallback(
    async (src: ParsedInput) => {
      if (src.kind !== 'share' && src.kind !== 'legacyShare') return;
      setPhase('loading');
      cache.current = {};
      try {
        token.current = src.kind === 'share' ? await accessToken(src.linkKey) : undefined;
        const info = await getMeta(src.id, token.current);
        setMeta(info);
        setExpiresAt(info.expires_at);
        setPhase('ready');
        // Sin contraseña ni autodestrucción no hace falta ningún paso más
        if (src.kind === 'share' && !info.destroy && !info.protected) decrypt(src, '');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) finish('notFound');
        else {
          showError(t(apiErrorKey(err)));
          setPhase('input');
        }
      }
    },
    [decrypt, finish, showError, t]
  );

  // Enlace abierto directamente (/message#c=…&k=… o el antiguo ?code=…)
  useEffect(() => {
    const parsed = parseLocation(location as unknown as Location);
    if (parsed) {
      setSource(parsed);
      setFromLink(true);
      loadRemote(parsed);
    }
    // Solo al montar: cada navegación vuelve a montar la pestaña
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTextChange = (value: string) => {
    setText(value);
    const parsed = parseInput(value);
    setSource(parsed);
    setMeta(null);
    setAttemptsLeft(null);
    if (isRemote(parsed)) loadRemote(parsed!);
    else setPhase('input');
  };

  const handleDelete = async () => {
    if (!source || !isRemote(source)) return;
    try {
      await deleteShare((source as { id: string }).id, token.current);
      showSuccess(t('notifications.success.messageDeleted'));
      finish('deleted');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) finish('notFound');
      else showError(t('notifications.error.deleteError'));
    }
  };

  const startOver = () => navigate('/message', { replace: fromLink });

  const needsPassword =
    source?.kind === 'local' || source?.kind === 'legacyLocal' || source?.kind === 'legacyShare' || (source?.kind === 'share' && !!meta?.protected);
  const canSubmit = !!source && (!needsPassword || password.length > 0) && (phase === 'input' || phase === 'ready');
  const busy = phase === 'loading' || phase === 'decrypting';

  if (phase === 'gone') {
    const titles: Record<GoneReason, string> = {
      notFound: t('notifications.error.messageNotFound'),
      deleted: t('notifications.error.messageDeleted'),
      attempts: t('notifications.error.tooManyAttempts'),
      expired: t('countdown.expired'),
    };
    return (
      <GoneView
        title={titles[gone || 'notFound']}
        description={gone === 'notFound' ? t('decrypt.notFoundHint') : undefined}
        actionLabel={t('decrypt.another')}
        onAction={startOver}
        celebrate={gone !== 'notFound'}
      />
    );
  }

  if (phase === 'decrypted' && result) {
    const canDelete = isRemote(source) && !burned;
    return (
      <div className="space-y-4">
        {burned && <Notice tone="success">{t('decrypt.burnedNotice')}</Notice>}
        {meta?.receipt && source?.kind === 'share' && !findReceipt(source.id) && <Notice>{t('decrypt.receiptNotice')}</Notice>}
        <DecryptedContent payload={result} />
        {expiresAt && !burned && <CountdownTimer expiresAt={expiresAt} onExpire={() => finish('expired')} />}
        <div className={`grid gap-3 ${canDelete ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          {canDelete && (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={handleDelete} block>
              {t('form.deleteNow')}
            </Button>
          )}
          <Button variant="secondary" onClick={startOver} block>
            {t('decrypt.another')}
          </Button>
        </div>
      </div>
    );
  }

  const detected = source
    ? {
        share: t('decrypt.detected.share'),
        legacyShare: t('decrypt.detected.legacyShare'),
        local: t('decrypt.detected.local'),
        legacyLocal: t('decrypt.detected.legacyLocal'),
      }[source.kind]
    : null;

  return (
    <form
      className="space-y-4"
      onSubmit={e => {
        e.preventDefault();
        if (canSubmit && source) decrypt(source, password);
      }}
    >
      {fromLink ? (
        <Card className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Link2 className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{t('decrypt.linkTitle')}</p>
            <p className="text-sm text-gray-500">{t('decrypt.linkDescription')}</p>
          </div>
        </Card>
      ) : (
        <div>
          <textarea
            className={`${inputClass} min-h-[8rem] resize-y font-mono sm:min-h-[10rem]`}
            rows={5}
            placeholder={t('messagePlaceholder')}
            value={text}
            onChange={e => onTextChange(e.target.value)}
            disabled={busy}
            aria-label={t('messagePlaceholder')}
            spellCheck={false}
            autoCapitalize="off"
          />
          {text.trim() && (
            <p className={`mt-1 text-xs ${detected ? 'text-green-700' : 'text-amber-700'}`}>{detected || t('decrypt.detected.none')}</p>
          )}
        </div>
      )}

      {phase === 'loading' && <Spinner label={t('form.loading')} />}

      {phase !== 'loading' && (
        <>
          {meta?.destroy && <Notice tone="warning">{t('decrypt.destroyWarning')}</Notice>}
          {meta?.receipt && source?.kind === 'share' && !findReceipt(source.id) && <Notice>{t('decrypt.receiptNotice')}</Notice>}
          {expiresAt && <CountdownTimer expiresAt={expiresAt} onExpire={() => finish('expired')} />}

          {needsPassword && (
            <Card>
              <PasswordField
                label={source?.kind === 'share' ? t('decrypt.extraPassword') : t('decrypt.password')}
                placeholder={t('form.secretKey')}
                value={password}
                onChange={setPassword}
                autoComplete="off"
                autoFocus={fromLink}
                disabled={busy}
              />
              {attemptsLeft !== null && attemptsLeft > 0 && (
                <p className="mt-2 text-sm font-medium text-amber-700">
                  {t('decryptWrongKeyAndAttempts', { count: attemptsLeft })}
                  {attemptsLeft === 1 && <> — {t('destroyOnNextFail')}</>}
                </p>
              )}
            </Card>
          )}

          <Button
            type="submit"
            block
            loading={phase === 'decrypting'}
            disabled={!canSubmit}
            icon={meta?.destroy ? <Eye className="h-4 w-4" /> : needsPassword ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          >
            {phase === 'decrypting' ? t('form.decrypting') : meta?.destroy ? t('decrypt.revealOnce') : t('form.decrypt')}
          </Button>

          {!fromLink && !source && <Notice>{t('decrypt.note')}</Notice>}
        </>
      )}
    </form>
  );
};

export default DecryptTab;
