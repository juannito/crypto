import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Inbox, KeyRound, MailQuestion, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useActivity } from '../hooks/useActivity';
import { concatBytes } from '../crypto/encoding';
import { open, seal } from '../crypto/envelope';
import { decodePayload, DecryptedPayload, encodePayload } from '../crypto/payload';
import { generateRequestKeys, openSealed, ownerToken, RequestKeys, respondToken, sealTo } from '../crypto/sealedBox';
import {
  apiErrorKey,
  ApiError,
  createRequest,
  deleteRequest,
  getRequestInfo,
  getRequestStatus,
  openRequest,
  RequestStatus,
  respondRequest,
} from '../lib/api';
import { buildInboxLink, buildRequestLink, InboxLink, parseInboxLink, parseRequestLink } from '../lib/links';
import { addRequest, findRequest, loadRequests, removeRequest, StoredRequest } from '../lib/requestStore';
import Composer, { contentError, MIN_PASSWORD_LENGTH } from './Composer';
import CountdownTimer from './CountdownTimer';
import { DecryptedContent, GoneView } from './ResultViews';
import { Button, Card, CopyButton, Field, inputClass, LinkBox, Notice, PasswordField, Spinner, Toggle, useExpireOptions } from './ui';

const splitKeys = (bytes: Uint8Array): RequestKeys => ({ publicKey: bytes.slice(0, 65), privateKey: bytes.slice(65, 97) });
const pathOf = (url: string) => {
  const u = new URL(url);
  return u.pathname + u.hash;
};

//
// Crear solicitud
//
interface Created {
  requestLink: string;
  inboxLink: string;
  locked: boolean;
  saved: boolean;
}

const CreateRequest: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const { t } = useTranslation();
  const { showError, showSuccess } = useNotifications();
  const expireOptions = useExpireOptions();
  const [label, setLabel] = useState('');
  const [expire, setExpire] = useState('604800');
  const [passcode, setPasscode] = useState('');
  const [save, setSave] = useState(true);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode && passcode.length < MIN_PASSWORD_LENGTH) return showError(t('notifications.warning.keyTooShort'));
    setBusy(true);
    try {
      const keys = await generateRequestKeys();
      const own = await ownerToken(keys);
      const { id, expires_at } = await createRequest(expire, own, await respondToken(keys.publicKey));
      const keyBytes = concatBytes(keys.publicKey, keys.privateKey);
      const inbox: InboxLink = passcode
        ? { id, kind: 'locked', sealed: await seal(keyBytes, { password: passcode }) }
        : { id, kind: 'plain', keys: keyBytes };
      const requestLink = buildRequestLink(id, keys.publicKey, label.trim());
      const inboxLink = buildInboxLink(inbox);
      if (save) {
        addRequest({ id, label: label.trim(), createdAt: Date.now(), expiresAt: expires_at, requestLink, inboxLink, locked: !!passcode, ownerToken: own });
      }
      setCreated({ requestLink, inboxLink, locked: !!passcode, saved: save });
      showSuccess(t('requests.created'));
    } catch (err) {
      showError(t(apiErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <div className="space-y-4">
        <Card className="space-y-3">
          <StepTitle n={1} title={t('requests.step1Title')} />
          <p className="text-sm text-gray-600">{t('requests.step1Text')}</p>
          <LinkBox url={created.requestLink} copyLabel={t('requests.copyRequestLink')} qrCaption={t('response.scanWithPhone')} />
        </Card>
        <Card className="space-y-3 border-amber-200">
          <StepTitle n={2} title={t('requests.step2Title')} />
          <p className="text-sm text-gray-600">{created.saved ? t('requests.step2TextSaved') : t('requests.step2Text')}</p>
          <LinkBox url={created.inboxLink} copyLabel={t('requests.copyInboxLink')} qrCaption={t('requests.inboxQrCaption')} qrOpen />
          <Notice tone={created.locked ? 'info' : 'warning'}>{created.locked ? t('requests.lockedNote') : t('requests.plainNote')}</Notice>
        </Card>
        <Button
          variant="secondary"
          block
          onClick={() => {
            setCreated(null);
            setLabel('');
            setPasscode('');
            onCreated();
          }}
        >
          {t('requests.done')}
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Card className="space-y-4">
        <Field label={t('requests.labelLabel')} htmlFor="req-label" hint={t('requests.labelHint')}>
          <input
            id="req-label"
            className={inputClass}
            placeholder={t('requests.labelPlaceholder')}
            value={label}
            maxLength={120}
            onChange={e => setLabel(e.target.value)}
            disabled={busy}
          />
        </Field>
        <Field label={t('form.expires')} htmlFor="req-expire">
          <select id="req-expire" className={inputClass} value={expire} onChange={e => setExpire(e.target.value)} disabled={busy}>
            {expireOptions.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <PasswordField
          label={t('requests.passcodeLabel')}
          placeholder={t('requests.passcodePlaceholder')}
          hint={t('requests.passcodeHint')}
          value={passcode}
          onChange={setPasscode}
          showStrength
          disabled={busy}
        />
        <Toggle checked={save} onChange={setSave} label={t('requests.saveLabel')} description={t('requests.saveHint')} disabled={busy} />
      </Card>
      <Button type="submit" block loading={busy} icon={<MailQuestion className="h-4 w-4" />}>
        {t('requests.create')}
      </Button>
      <Notice>{t('requests.note')}</Notice>
    </form>
  );
};

const StepTitle: React.FC<{ n: number; title: string }> = ({ n, title }) => (
  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white">{n}</span>
    {title}
  </h3>
);

//
// Mis solicitudes
//
type ListStatus = RequestStatus | 'gone' | 'loading';

const StatusBadge: React.FC<{ status: ListStatus }> = ({ status }) => {
  const { t } = useTranslation();
  const styles: Record<ListStatus, string> = {
    loading: 'bg-gray-100 text-gray-500',
    pending: 'bg-amber-100 text-amber-800',
    answered: 'bg-green-100 text-green-800',
    gone: 'bg-gray-100 text-gray-500',
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status]}`}>{t(`requests.status.${status}`)}</span>;
};

export const MyRequestsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showError } = useNotifications();
  const activity = useActivity();
  const [items, setItems] = useState<StoredRequest[]>(loadRequests);
  const { refresh } = activity;

  useEffect(() => {
    refresh();
  }, [refresh]);

  const statusOf = (id: string): ListStatus => {
    const s = activity.requests[id]?.status;
    return s === undefined ? 'loading' : s;
  };

  const forget = (id: string) => {
    removeRequest(id);
    setItems(loadRequests());
    refresh();
  };

  const remove = async (item: StoredRequest) => {
    try {
      await deleteRequest(item.id, item.ownerToken);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) return showError(t(apiErrorKey(err)));
    }
    forget(item.id);
  };

  const header = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-gray-900">{t('requests.myRequests')}</h2>
      <Button variant="secondary" icon={<MailQuestion className="h-4 w-4" />} onClick={() => navigate('/requests')}>
        {t('requests.new')}
      </Button>
    </div>
  );

  if (items.length === 0) {
    return (
      <>
        {header}
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">{t('requests.empty')}</p>
      </>
    );
  }

  return (
    <>
      {header}
      <ul className="space-y-3">
        {items.map(item => {
          const status = statusOf(item.id);
          return (
            <li key={item.id}>
              <Card className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{item.label || t('requests.untitled')}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(item.createdAt).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })}
                      {item.locked && ` · ${t('requests.locked')}`}
                    </p>
                  </div>
                  <StatusBadge status={status} />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {status !== 'gone' && (
                    <Button variant={status === 'answered' ? 'primary' : 'secondary'} icon={<Inbox className="h-4 w-4" />} onClick={() => navigate(pathOf(item.inboxLink))}>
                      {t('requests.openInbox')}
                    </Button>
                  )}
                  {status === 'pending' && <CopyButton text={item.requestLink} label={t('requests.copyRequestLinkShort')} variant="secondary" />}
                  {status === 'gone' ? (
                    <Button variant="ghost" onClick={() => forget(item.id)} className="col-span-2">
                      {t('requests.forget')}
                    </Button>
                  ) : (
                    <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => remove(item)} className={status === 'answered' ? '' : 'col-span-2'}>
                      {t('requests.delete')}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
};

//
// Pestaña principal (/requests)
//
export const RequestsTab: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh, pendingAnswers } = useActivity();
  const count = loadRequests().length;
  return (
    <div className="space-y-4">
      <CreateRequest
        onCreated={() => {
          refresh();
          navigate('/my-requests');
        }}
      />
      {count > 0 && (
        <button
          type="button"
          onClick={() => navigate('/my-requests')}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-gray-400" aria-hidden />
            {t('requests.myRequests')} ({count})
            {pendingAnswers > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">{t('requests.newAnswers', { count: pendingAnswers })}</span>
            )}
          </span>
          <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden />
        </button>
      )}
    </div>
  );
};

//
// Responder una solicitud (/request#r=…&p=…)
//
export const RespondView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showError } = useNotifications();
  const [link] = useState(() => parseRequestLink(window.location));
  const [state, setState] = useState<'loading' | 'pending' | 'answered' | 'gone' | 'sent' | 'invalid'>(link ? 'loading' : 'invalid');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    if (!link) return;
    (async () => {
      try {
        const tok = await respondToken(link.publicKey);
        setToken(tok);
        const info = await getRequestInfo(link.id, tok);
        setExpiresAt(info.expires_at);
        setState(info.status);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) setState('gone');
        else {
          showError(t(apiErrorKey(err)));
          setState('gone');
        }
      }
    })();
  }, [link, showError, t]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = contentError(message, files);
    if (error) return showError(t(error));
    setBusy(true);
    try {
      const box = await sealTo(link!.publicKey, await encodePayload(message.trim(), files));
      await respondRequest(link!.id, token, box);
      setMessage('');
      setState('sent');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setState('answered');
      else if (err instanceof ApiError && err.status === 404) setState('gone');
      else showError(t(apiErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const home = () => navigate('/');

  if (state === 'loading') return <Spinner label={t('form.loading')} />;
  if (state === 'invalid' || state === 'gone')
    return <GoneView title={t('respond.goneTitle')} description={t('respond.goneText')} actionLabel={t('respond.home')} onAction={home} celebrate={false} />;
  if (state === 'answered')
    return <GoneView title={t('respond.answeredTitle')} description={t('respond.answeredText')} actionLabel={t('respond.home')} onAction={home} celebrate={false} />;
  if (state === 'sent')
    return <GoneView title={t('respond.sentTitle')} description={t('respond.sentText')} actionLabel={t('respond.home')} onAction={home} />;

  return (
    <form className="space-y-4" onSubmit={send}>
      <Card className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <KeyRound className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{t('respond.title')}</p>
          {link!.label && <p className="mt-0.5 break-words text-base font-medium text-blue-700">“{link!.label}”</p>}
          <p className="mt-1 text-sm text-gray-500">{t('respond.explanation')}</p>
        </div>
      </Card>
      {expiresAt && <CountdownTimer expiresAt={expiresAt} onExpire={() => setState('gone')} />}
      <Composer message={message} onMessageChange={setMessage} onFilesChange={setFiles} disabled={busy} placeholder={t('respond.placeholder')} />
      <Button type="submit" block loading={busy} icon={<Send className="h-4 w-4" />}>
        {busy ? t('form.encrypting') : t('respond.send')}
      </Button>
      <Notice>{t('respond.note')}</Notice>
    </form>
  );
};

//
// Buzón del solicitante (/inbox#r=…&s=… o &e=…)
//
export const InboxView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotifications();
  const [link] = useState(() => parseInboxLink(window.location));
  const [keys, setKeys] = useState<RequestKeys | null>(link?.kind === 'plain' ? splitKeys(link.keys) : null);
  const [passcode, setPasscode] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<RequestStatus | 'loading' | 'gone'>('loading');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [payload, setPayload] = useState<DecryptedPayload | null>(null);
  const [busy, setBusy] = useState(false);
  // Se lee una sola vez: al retirar la respuesta la entrada se quita de la lista
  const [stored] = useState(() => (link ? findRequest(link.id) : undefined));
  const [saved, setSaved] = useState(!!stored);
  const { refresh: refreshActivity } = useActivity();

  const refresh = useCallback(async (tok: string) => {
    if (!link) return;
    try {
      const info = await getRequestStatus(link.id, tok);
      setStatus(info.status);
      setExpiresAt(info.expires_at);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setStatus('gone');
      else showError(t(apiErrorKey(err)));
    }
  }, [link, showError, t]);

  useEffect(() => {
    if (!keys) return;
    ownerToken(keys).then(tok => {
      setToken(tok);
      refresh(tok);
    });
  }, [keys, refresh]);

  // Mientras espera, consulta cada 15 s si ya llegó la respuesta
  useEffect(() => {
    if (status !== 'pending' || !token) return;
    const timer = setInterval(() => refresh(token), 15000);
    return () => clearInterval(timer);
  }, [status, token, refresh]);

  const unlock = async () => {
    if (link?.kind !== 'locked') return;
    setUnlocking(true);
    try {
      setKeys(splitKeys(await open(link.sealed, { password: passcode })));
    } catch {
      showError(t('inbox.wrongPasscode'));
    } finally {
      setUnlocking(false);
    }
  };

  const retrieve = async () => {
    if (!link || !keys) return;
    setBusy(true);
    try {
      const box = await openRequest(link.id, token);
      setPayload(decodePayload(await openSealed(keys, box)));
      removeRequest(link.id);
      refreshActivity();
      showSuccess(t('notifications.success.messageDecrypted'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setStatus('gone');
      else if (err instanceof ApiError && err.status === 409) setStatus('pending');
      else showError(t(apiErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!link) return;
    try {
      await deleteRequest(link.id, token);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) return showError(t(apiErrorKey(err)));
    }
    removeRequest(link.id);
    setStatus('gone');
    refreshActivity();
  };

  const saveHere = () => {
    if (!link || !keys) return;
    addRequest({
      id: link.id,
      label: '',
      createdAt: Date.now(),
      expiresAt,
      requestLink: buildRequestLink(link.id, keys.publicKey, ''),
      inboxLink: window.location.href,
      locked: link.kind === 'locked',
      ownerToken: token,
    });
    setSaved(true);
    refreshActivity();
  };

  const backToList = () => navigate('/my-requests');

  if (!link) return <GoneView title={t('inbox.invalidTitle')} actionLabel={t('requests.backToList')} onAction={backToList} celebrate={false} />;

  if (!keys) {
    return (
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault();
          unlock();
        }}
      >
        <Card className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Inbox className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{t('inbox.lockedTitle')}</p>
              <p className="text-sm text-gray-500">{t('inbox.lockedText')}</p>
            </div>
          </div>
          <PasswordField label={t('requests.passcodeLabelShort')} value={passcode} onChange={setPasscode} autoComplete="off" autoFocus disabled={unlocking} />
        </Card>
        <Button type="submit" block loading={unlocking} disabled={!passcode}>
          {t('inbox.unlock')}
        </Button>
      </form>
    );
  }

  if (payload) {
    return (
      <div className="space-y-4">
        <Notice tone="success">{t('inbox.retrievedNotice')}</Notice>
        <DecryptedContent payload={payload} title={stored?.label || t('inbox.answerTitle')} />
        <Button variant="secondary" block onClick={backToList}>
          {t('requests.backToList')}
        </Button>
      </div>
    );
  }

  if (status === 'loading') return <Spinner label={t('form.loading')} />;
  if (status === 'gone')
    return <GoneView title={t('inbox.goneTitle')} description={t('inbox.goneText')} actionLabel={t('requests.backToList')} onAction={backToList} celebrate={false} />;

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('inbox.title')}</p>
            <p className="truncate text-base font-semibold text-gray-900">{stored?.label || t('requests.untitled')}</p>
          </div>
          <StatusBadge status={status} />
        </div>
        {status === 'pending' ? (
          <p className="text-sm text-gray-600">{t('inbox.pendingText')}</p>
        ) : (
          <Notice tone="warning">{t('inbox.answeredText')}</Notice>
        )}
      </Card>

      {expiresAt && <CountdownTimer expiresAt={expiresAt} onExpire={() => setStatus('gone')} />}

      {status === 'answered' ? (
        <Button block loading={busy} icon={<Inbox className="h-4 w-4" />} onClick={retrieve}>
          {t('inbox.retrieve')}
        </Button>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CopyButton text={stored?.requestLink || buildRequestLink(link.id, keys.publicKey, '')} label={t('requests.copyRequestLink')} block />
          <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => refresh(token)} block>
            {t('inbox.refresh')}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!saved && (
          <Button variant="secondary" onClick={saveHere} block>
            {t('inbox.saveHere')}
          </Button>
        )}
        <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={remove} block className={saved ? 'sm:col-span-2' : ''}>
          {t('requests.delete')}
        </Button>
      </div>
    </div>
  );
};
