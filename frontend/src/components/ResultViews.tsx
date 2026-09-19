import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Lottie from 'lottie-react';
import ConfettiExplosion from 'react-confetti-explosion';
import groovyWalkAnimation from '../assets/groovyWalk.json';
import type { DecryptedPayload } from '../crypto/payload';
import FileDownload from './FileDownload';
import { Button, CopyButton } from './ui';

// Mensaje y archivos descifrados
export const DecryptedContent: React.FC<{ payload: DecryptedPayload; title?: string }> = ({ payload, title }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {payload.message && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-green-900">{title || t('decryptedMessage')}</h3>
            <CopyButton text={payload.message} variant="secondary" className="!min-h-[36px] !px-3 !py-1.5" />
          </div>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-green-950">{payload.message}</div>
        </div>
      )}
      <FileDownload files={payload.files} />
    </div>
  );
};

// Pantalla final: mensaje borrado, expirado o inexistente
export const GoneView: React.FC<{ title: string; description?: string; actionLabel: string; onAction: () => void; celebrate?: boolean }> = ({
  title,
  description,
  actionLabel,
  onAction,
  celebrate = true,
}) => {
  const [confetti, setConfetti] = useState(celebrate);
  useEffect(() => {
    if (!confetti) return;
    const timer = setTimeout(() => setConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, [confetti]);

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-2 text-center">
      {confetti && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <ConfettiExplosion force={0.7} duration={3000} particleCount={120} width={Math.min(1400, window.innerWidth * 1.5)} />
        </div>
      )}
      <div className="mb-4 h-40 w-40 sm:h-48 sm:w-48">
        <Lottie animationData={groovyWalkAnimation} loop />
      </div>
      <p className="text-lg font-semibold text-gray-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      <Button className="mt-6" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
};
