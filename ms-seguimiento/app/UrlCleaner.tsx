// ms-seguimiento/app/UrlCleaner.tsx
'use client';

import { useEffect } from 'react';

export default function UrlCleaner() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      // Borramos el parámetro de la URL de forma sutil sin recargar
      if (url.searchParams.has('usuario')) {
        url.searchParams.delete('usuario');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }
  }, []);

  return null;
}