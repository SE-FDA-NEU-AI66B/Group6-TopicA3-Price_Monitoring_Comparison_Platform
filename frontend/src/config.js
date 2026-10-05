const LOCAL_API_BASE_URL = 'http://localhost:3000/api';
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (configuredBaseUrl || LOCAL_API_BASE_URL)
  .replace(/\/+$/, '');
