// Por defecto el frontend habla con el backend en el mismo origen.
// En desarrollo, el proxy de CRA (package.json → "proxy") reenvía las
// peticiones al backend; REACT_APP_BACKEND_URL permite apuntar a otro host
// (que deberá permitir ese origen en CORS_ORIGINS).
export const getBackendURL = (): string => process.env.REACT_APP_BACKEND_URL || '';
