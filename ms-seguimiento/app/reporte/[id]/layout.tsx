// ms-seguimiento/app/reporte/[id]/layout.tsx
import React from 'react';

export const metadata = {
  title: 'Detalle del Reporte - EduInspect',
  description: 'Módulo de visualización detallada de incidentes institucionales.',
};

export default function DetalleReporteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section style={{ minHeight: '100vh', width: '100%' }}>
      {children}
    </section>
  );
}