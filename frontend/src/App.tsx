import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ShareTab from './components/ShareTab';
import EncryptTab from './components/EncryptTab';
import DecryptTab from './components/DecryptTab';
import HelpTab from './components/HelpTab';
import Modal from './components/Modal';
import NotificationContainer from './components/NotificationContainer';
import LanguageSelector from './components/LanguageSelector';
import { useNotifications } from './hooks/useNotifications';

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('online');
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ title: '', content: '', status: '' });
  const { notifications, removeNotification } = useNotifications();

  // Detectar parámetros de URL y cambiar pestaña automáticamente
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    if (code) {
      setActiveTab('message');
    }
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const showSuccessModal = (title: string, content: string) => {
    setModalData({ title, content, status: 'success' });
    setShowModal(true);
  };

  return (
    <Router>
      <div className="App min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col">
          <div className="container mx-auto max-w-4xl px-4 mt-8">
            {/* Header con selector de idioma */}
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Crypto Messenger</h1>
              <LanguageSelector />
            </div>
            
            <div className="page-header mb-6">
              <ul className="nav nav-pills flex space-x-1 bg-gray-100 p-1 rounded-lg">
                <li className={`flex-1 ${activeTab === 'online' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  <a 
                    onClick={() => handleTabChange('online')} 
                    href="#online"
                    className="block px-4 py-2 text-center rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    {t('tabs.online')}
                  </a>
                </li>
                <li className={`flex-1 ${activeTab === 'traditional' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  <a 
                    onClick={() => handleTabChange('traditional')} 
                    href="#traditional"
                    className="block px-4 py-2 text-center rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    {t('tabs.traditional')}
                  </a>
                </li>
                <li className={`flex-1 ${activeTab === 'message' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  <a 
                    onClick={() => handleTabChange('message')} 
                    href="#message"
                    className="block px-4 py-2 text-center rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    {t('tabs.message')}
                  </a>
                </li>
                <li className={`flex-1 ${activeTab === 'help' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  <a 
                    onClick={() => handleTabChange('help')} 
                    href="#help"
                    className="block px-4 py-2 text-center rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    {t('tabs.help')}
                  </a>
                </li>
              </ul>
            </div>
            {/* Texto explicativo según la tab activa */}
            <div className="mb-6 text-center text-sm text-gray-600 min-h-6">
              {activeTab === 'online' && (
                <span dangerouslySetInnerHTML={{ __html: t('descriptions.online') }} />
              )}
              {activeTab === 'traditional' && (
                <span>{t('descriptions.traditional')}</span>
              )}
              {activeTab === 'message' && (
                <span>{t('descriptions.message')}</span>
              )}
            </div>

            <div className="tab-content">
              {activeTab === 'online' && <ShareTab onSuccess={showSuccessModal} />}
              {activeTab === 'traditional' && <EncryptTab />}
              {activeTab === 'message' && <DecryptTab />}
              {activeTab === 'help' && <HelpTab />}
            </div>
          </div>
        </div>
        {/* Removido el footer de baicom por pedido del usuario */}

        {showModal && (
          <Modal
            title={modalData.title}
            content={modalData.content}
            status={modalData.status}
            onClose={() => setShowModal(false)}
          />
        )}

        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={removeNotification}
        />
      </div>
    </Router>
  );
}

export default App;
