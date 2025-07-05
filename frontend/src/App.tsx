import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import OnlineTab from './components/OnlineTab';
import TraditionalTab from './components/TraditionalTab';
import MessageTab from './components/MessageTab';
import HelpTab from './components/HelpTab';
import Modal from './components/Modal';
import NotificationContainer from './components/NotificationContainer';
import { useNotifications } from './hooks/useNotifications';

function App() {
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
            <div className="page-header mb-6">
              <ul className="nav nav-pills flex space-x-1 bg-gray-100 p-1 rounded-lg">
                <li className={`flex-1 ${activeTab === 'online' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  <a 
                    onClick={() => handleTabChange('online')} 
                    href="#online"
                    className="block px-4 py-2 text-center rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    Online
                  </a>
                </li>
                <li className={`flex-1 ${activeTab === 'traditional' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  <a 
                    onClick={() => handleTabChange('traditional')} 
                    href="#traditional"
                    className="block px-4 py-2 text-center rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    Tradicional
                  </a>
                </li>
                <li className={`flex-1 ${activeTab === 'message' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  <a 
                    onClick={() => handleTabChange('message')} 
                    href="#message"
                    className="block px-4 py-2 text-center rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    Mensaje
                  </a>
                </li>
                <li className={`flex-1 ${activeTab === 'help' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  <a 
                    onClick={() => handleTabChange('help')} 
                    href="#help"
                    className="block px-4 py-2 text-center rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    Ayuda
                  </a>
                </li>
              </ul>
            </div>
            {/* Texto explicativo según la tab activa */}
            <div className="mb-6 text-center text-sm text-gray-600 min-h-6">
              {activeTab === 'online' && (
                <span>
                  Encripta tu mensaje y obtén un enlace seguro para compartir.<br/>
                  <b>Importante:</b>  Al grabarlo, el navegador <u>primero encripta los datos localmente</u> y luego los envía al servidor para generar el link de intercambio. Puedes elegir que el mensaje se destruya al leerlo.
                </span>
              )}
              {activeTab === 'traditional' && (
                <span>Encripta tu mensaje localmente, sin enviarlo a ningún servidor. Solo tú tienes el código encriptado.</span>
              )}
              {activeTab === 'message' && (
                <span>Pega aquí un enlace o código encriptado para desencriptar y ver el mensaje original.</span>
              )}
            </div>

            <div className="tab-content">
              {activeTab === 'online' && <OnlineTab onSuccess={showSuccessModal} />}
              {activeTab === 'traditional' && <TraditionalTab />}
              {activeTab === 'message' && <MessageTab />}
              {activeTab === 'help' && <HelpTab />}
            </div>
          </div>
        </div>
        <footer className="bg-gray-100 mt-8">
          <div className="container mx-auto max-w-4xl px-4">
            <p className="text-center py-4 text-gray-600">
              powered by <a href="http://baicom.com/?crypto" className="text-blue-600 hover:underline">baicom</a>
            </p>
          </div>
        </footer>

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
