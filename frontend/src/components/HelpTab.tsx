import React from 'react';

const HelpTab: React.FC = () => {
  return (
    <div className="tab-pane fade space-y-4">
      <p className="text-gray-700 leading-relaxed">
        El sistema posee dos modalidades principales: <strong className="text-blue-600">ONLINE</strong>, que permite generar un mensaje encriptado y guardarlo para compartir mediante un enlace, y <strong className="text-blue-600">TRADICIONAL</strong>, que ofrece una interfaz para encriptar un texto localmente, sin almacenamiento en el servidor. En ambos modos, es necesario utilizar una clave para desencriptar información de forma segura desde la tab de Mensaje.
      </p>
      <p className="text-gray-700 leading-relaxed">
        Los mensajes en la modalidad <strong className="text-blue-600">ONLINE</strong> no se almacenan en texto plano. Al hacer clic en el botón "Grabar", el navegador primero encripta los datos localmente y luego los envía al servidor para generar el enlace de intercambio.
      </p>
      <p className="text-gray-700 leading-relaxed">
        Además, esta modalidad permite establecer un tiempo de expiración para el mensaje y activar la opción de destruirlo al ser leído. De esta manera, la persona que recibe el enlace solo tendrá una oportunidad para acceder al mensaje.
      </p>
      <p className="text-gray-700 leading-relaxed">
        Para mayor seguridad, se recomienda que la clave sea lo más larga posible, preferentemente una frase.
      </p>
      <p className="text-gray-700 leading-relaxed">
        El código fuente está disponible en <a href="http://github.com/juannito/crypto" className="text-blue-600 hover:underline">GitHub</a>.
      </p>
    </div>
  );
};

export default HelpTab; 