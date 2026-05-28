// ms-auth/app/page.tsx
import { redirect } from 'next/navigation';
import mysql from 'mysql2/promise';

// 🚨 DIRECTIVA CRÍTICA: Fuerza a Next.js a procesar la base de datos en vivo dentro de Docker
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const hasError = params.error === 'credentials';

  async function handleLogin(formData: FormData) {
    'use server'
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    let userToRedirect = null;
    let loginFailed = false;

    try {
      // Conexión nativa al contenedor 'db'
      const connection = await mysql.createConnection({
        host: 'db', 
        user: 'root',
        password: 'root',
        database: 'vinculacion_db',
        port: 3306
      });

      const [rows]: any = await connection.execute(
        'SELECT * FROM User WHERE email = ? AND password = ?',
        [email, password]
      );

      await connection.end();

      if (rows.length > 0) {
        userToRedirect = rows[0];
      } else {
        loginFailed = true;
      }
    } catch (error) {
      console.error("❌ Error conectando a la DB interna de Docker:", error);
      loginFailed = true;
    }

    if (loginFailed) {
      redirect('http://localhost:3000?error=credentials');
    }

    if (userToRedirect) {
      // 🛠️ CORRECCIÓN CRÍTICA: Heredamos el correo del usuario en la URL para que el ms-seguimiento valide su rol relacional
      redirect(`http://localhost:3002?usuario=${encodeURIComponent(userToRedirect.email)}`); 
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '20px' }}>
      <div style={{ backgroundColor: '#1e293b', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)', width: '100%', maxWidth: '400px', border: '1px solid #334155' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ color: '#f8fafc', fontSize: '28px', fontWeight: '700', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Vinculación Empresarial
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0' }}>
            Módulo de Administración Institucional
          </p>
        </div>

        {hasError && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '14px', textAlign: 'center', marginBottom: '20px', fontWeight: '500' }}>
            ⚠️ Correo o contraseña incorrectos.
          </div>
        )}

        <form action={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>Correo electrónico</label>
            <input type="email" name="email" placeholder="ejemplo@fes.unam.mx" required style={{ padding: '12px 16px', borderRadius: '8px', border: hasError ? '1px solid #ef4444' : '1px solid #475569', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: '15px', outline: 'none' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>Contraseña</label>
            <input type="password" name="password" placeholder="••••••••" required style={{ padding: '12px 16px', borderRadius: '8px', border: hasError ? '1px solid #ef4444' : '1px solid #475569', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: '15px', outline: 'none' }} />
          </div>

          <button type="submit" style={{ padding: '14px', borderRadius: '8px', background: '#2563eb', color: 'white', border: 'none', fontWeight: '600', fontSize: '16px', cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}>
            Acceder al Sistema
          </button>
        </form>

        {/* 🛠️ NUEVO: Enlace público para que alumnos y docentes creen su cuenta con id_role = 3 */}
        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
          <span style={{ color: '#94a3b8', fontSize: '13px' }}>¿No tienes cuenta? </span>
          <a href="/registro" style={{ color: '#38bdf8', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>
            Regístrate aquí
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <p style={{ color: '#64748b', fontSize: '12px', margin: '0' }}>
            FES Aragón — Ingeniería en Computación
          </p>
        </div>
      </div>
    </div>
  );
}