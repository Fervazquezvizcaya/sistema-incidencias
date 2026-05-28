// ms-seguimiento/app/layout.tsx
export const metadata = {
  title: 'Sistema de Vinculación - Dashboard',
  description: 'Módulo de Seguimiento Administrativo',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  )
}