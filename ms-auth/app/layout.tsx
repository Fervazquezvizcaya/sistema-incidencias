// ms-auth/app/layout.tsx
export const metadata = {
  title: 'Sistema de Vinculación - Login',
  description: 'Módulo de Autenticación',
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