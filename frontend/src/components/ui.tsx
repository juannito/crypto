import React, { useEffect, useId, useState } from 'react';
import QRCode from 'react-qr-code';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, CheckCircle2, Copy, Eye, EyeOff, Info, Loader2, QrCode, ShieldAlert } from 'lucide-react';

//
// Botones
//
type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:ring-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  success: 'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500',
  ghost: 'text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: React.ReactNode;
  block?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading = false,
  icon,
  block = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
    {...rest}
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
    {children}
  </button>
);

//
// Contenedores y avisos
//
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>{children}</div>
);

const NOTICE_STYLES = {
  info: { box: 'bg-blue-50 border-blue-200 text-blue-900', icon: <Info className="h-5 w-5 text-blue-500" /> },
  warning: { box: 'bg-amber-50 border-amber-200 text-amber-900', icon: <AlertTriangle className="h-5 w-5 text-amber-500" /> },
  danger: { box: 'bg-red-50 border-red-200 text-red-900', icon: <ShieldAlert className="h-5 w-5 text-red-500" /> },
  success: { box: 'bg-green-50 border-green-200 text-green-900', icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> },
};

export const Notice: React.FC<{ tone?: keyof typeof NOTICE_STYLES; children: React.ReactNode; className?: string }> = ({
  tone = 'info',
  children,
  className = '',
}) => (
  <div className={`flex gap-3 rounded-lg border p-3 text-sm leading-relaxed ${NOTICE_STYLES[tone].box} ${className}`}>
    <span className="mt-0.5 flex-shrink-0" aria-hidden>
      {NOTICE_STYLES[tone].icon}
    </span>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

//
// Formularios
//
export const inputClass =
  'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-100 sm:text-sm';

export const Field: React.FC<{ label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }> = ({
  label,
  htmlFor,
  hint,
  children,
}) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700">
      {label}
    </label>
    {children}
    {hint && <p className="text-xs leading-relaxed text-gray-500">{hint}</p>}
  </div>
);

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }> = ({
  checked,
  onChange,
  label,
  description,
  disabled,
}) => {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 ${disabled ? 'opacity-50' : 'hover:bg-gray-50'}`}>
      <span className="relative mt-0.5 inline-flex flex-shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        {description && <span className="block text-xs leading-relaxed text-gray-500">{description}</span>}
      </span>
    </label>
  );
};

export interface ExpireOption {
  value: string;
  label: string;
}

export const useExpireOptions = (): ExpireOption[] => {
  const { t } = useTranslation();
  return [
    { value: '30', label: t('expiration.30seconds') },
    { value: '86400', label: t('expiration.1day') },
    { value: '604800', label: t('expiration.1week') },
    { value: '2592000', label: t('expiration.1month') },
  ];
};

//
// Contraseña con indicador de fortaleza
//
export function passwordStrength(password: string) {
  const checks = {
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const pool = (checks.lower ? 26 : 0) + (checks.upper ? 26 : 0) + (checks.number ? 10 : 0) + (checks.special ? 33 : 0);
  // Entropía estimada: la longitud pesa más que la variedad de caracteres
  const bits = password.length * Math.log2(Math.max(pool, 1));
  const level = bits < 45 ? 0 : bits < 70 ? 1 : 2;
  return { checks, bits, level };
}

const STRENGTH_STYLES = [
  { bar: 'bg-red-500', text: 'text-red-600', key: 'strength.insecure' },
  { bar: 'bg-amber-400', text: 'text-amber-600', key: 'strength.secure' },
  { bar: 'bg-green-500', text: 'text-green-600', key: 'strength.verySecure' },
];

export const StrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  const { t } = useTranslation();
  if (!password) return null;
  const { checks, bits, level } = passwordStrength(password);
  const style = STRENGTH_STYLES[level];
  const items: [keyof typeof checks, string][] = [
    ['length', t('strength.requirements.length')],
    ['upper', t('strength.requirements.uppercase')],
    ['lower', t('strength.requirements.lowercase')],
    ['number', t('strength.requirements.number')],
    ['special', t('strength.requirements.special')],
  ];
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
          <div className={`h-full rounded-full transition-all duration-300 ${style.bar}`} style={{ width: `${Math.min(100, (bits / 90) * 100)}%` }} />
        </div>
        <span className={`text-xs font-semibold ${style.text}`}>{t(style.key)}</span>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {items.map(([k, label]) => (
          <li
            key={k}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${checks[k] ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
          >
            {checks[k] && <Check className="h-3 w-3" aria-hidden />}
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
};

interface PasswordFieldProps {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  hint?: React.ReactNode;
  showStrength?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  onEnter?: () => void;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  value,
  onChange,
  label,
  placeholder,
  hint,
  showStrength = false,
  disabled,
  autoFocus,
  autoComplete = 'new-password',
  onEnter,
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`${inputClass} pr-12`}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:text-blue-600"
          aria-label={visible ? t('form.hideKey') : t('form.showKey')}
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {showStrength && <StrengthMeter password={value} />}
    </Field>
  );
};

//
// Copiar, QR y enlaces
//
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // se intenta el método alternativo
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  return ok;
}

export const CopyButton: React.FC<{ text: string; label?: string; variant?: Variant; block?: boolean; className?: string }> = ({
  text,
  label,
  variant = 'primary',
  block,
  className,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant={copied ? 'success' : variant}
      block={block}
      className={className}
      icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      onClick={async () => setCopied(await copyText(text))}
    >
      {copied ? t('response.copied') : label || t('form.copy')}
    </Button>
  );
};

export const QrBlock: React.FC<{ value: string; caption?: string; size?: number }> = ({ value, caption, size = 176 }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <QRCode value={value} size={size} level="M" title={caption || "QR"} style={{ height: 'auto', maxWidth: '100%', width: size }} />
    </div>
    {caption && <p className="text-center text-xs text-gray-500">{caption}</p>}
  </div>
);

// Enlace en una caja de solo lectura + copiar + QR plegable
export const LinkBox: React.FC<{ url: string; copyLabel?: string; qrCaption?: string; qrOpen?: boolean }> = ({
  url,
  copyLabel,
  qrCaption,
  qrOpen = false,
}) => {
  const { t } = useTranslation();
  const [showQr, setShowQr] = useState(qrOpen);
  return (
    <div className="space-y-3">
      <div className="break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs leading-relaxed text-gray-700 select-all">
        {url}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <CopyButton text={url} label={copyLabel} block />
        <Button variant="secondary" icon={<QrCode className="h-4 w-4" />} onClick={() => setShowQr(v => !v)} aria-expanded={showQr}>
          <span className="hidden sm:inline">{showQr ? t('form.hideQR') : t('form.showQR')}</span>
          <span className="sr-only sm:hidden">{showQr ? t('form.hideQR') : t('form.showQR')}</span>
        </Button>
      </div>
      {showQr && <QrBlock value={url} caption={qrCaption} />}
    </div>
  );
};

export const Spinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500" role="status">
    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
    {label}
  </div>
);

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
}
