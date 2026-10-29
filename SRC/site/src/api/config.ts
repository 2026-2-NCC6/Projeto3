// URL da API. Em produção, o endereço HTTPS do deploy; ver SRC/site/.env.example.
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '');
