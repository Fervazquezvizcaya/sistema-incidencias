// ms-registro/app/layout.tsx
export const metadata = {
  title: 'Sistema de Vinculación - Registro',
  description: 'Módulo de Registro Público',
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
