import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from './ui';

const SECTIONS = ['share', 'encrypt', 'requests', 'security', 'recommendation'] as const;

const HelpTab: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {SECTIONS.map(key => (
        <Card key={key}>
          <h3 className="mb-1 text-sm font-semibold text-gray-900">{t(`help.${key}.title`)}</h3>
          <p className="text-sm leading-relaxed text-gray-600">{t(`help.${key}.text`)}</p>
        </Card>
      ))}
      <p className="pt-2 text-center text-sm text-gray-500">
        {t('help.sourceCode')}{' '}
        <a href="https://github.com/juannito/crypto" className="font-medium text-blue-600 hover:underline" rel="noopener noreferrer" target="_blank">
          GitHub
        </a>
      </p>
    </div>
  );
};

export default HelpTab;
