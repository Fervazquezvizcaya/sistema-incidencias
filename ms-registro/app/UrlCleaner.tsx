// ms-registro/app/UrlCleaner.tsx
'use client';

import { useEffect } from 'react';

export default function UrlCleaner() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      // Si el correo viene colgado, lo limpiamos de la barra de forma invisible
      if (url.searchParams.has('usuario')) {
        url.searchParams.delete('usuario');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }
  }, []);

  return null;
}