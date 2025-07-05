import React from 'react';
import { useTranslation } from 'react-i18next';

const HelpTab: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="tab-pane fade space-y-4">
      <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('help.description') }} />
      <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('help.onlineSecurity') }} />
      <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('help.expiration') }} />
      <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('help.securityRecommendation') }} />
      <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('help.sourceCode') }} />
    </div>
  );
};

export default HelpTab; 