// ms-seguimiento/app/reporte/[id]/UrlCleaner.tsx
'use client';

import { useEffect } from 'react';

export default function UrlCleaner() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      // Si detecta el correo del usuario en la barra, lo elimina de inmediato
      if (url.searchParams.has('usuario')) {
        url.searchParams.delete('usuario');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }
  }, []);

  return null;
}