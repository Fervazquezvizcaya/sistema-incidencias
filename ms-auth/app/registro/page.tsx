// ms-auth/app/registro/page.tsx
import { redirect } from 'next/navigation';
import pool from '../../db';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function RegistroUsuarioPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isSuccess = params.success === 'true';
  const hasError = params.error === 'true';

  async function registrarNuevoUsuario(formData: FormData) {
    'use server'

    // 🛠️ CAPTURA: Jalamos el número de cuenta escrito manualmente
    const id = formData.get('numero_identificador') as string; 
    const nombre = formData.get('nombre') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    const idRoleUSER = 3; // Forzado a rol Alumno/Docente común

    let registroExitoso = false;

    try {
      // Inserción relacional usando el número de cuenta como la Primary Key (id)
      await pool.execute(
        `INSERT INTO User (id, email, nombre, password, id_role) VALUES (?, ?, ?, ?, ?)`,
        [id, email, nombre, password, idRoleUSER]
      );
      registroExitoso = true;
    } catch (error: any) {
      console.error("❌ Error en registro público:", error.message);
      registroExitoso = false;
    }

    if (registroExitoso) {
      redirect('/registro?success=true');
    } else {
      redirect('/registro?error=true');
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '20px' }}>
      <div style={{ backgroundColor: '#1e293b', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)', width: '100%', maxWidth: '450px', border: '1px solid #334155' }}>
        
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0', color: '#38bdf8' }}>Administración Institucional</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0' }}>Registro público para la Comunidad de FES Aragón</p>
        </div>

        {isSuccess && <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#a7f3d0', padding: '12px', borderRadius: '8px', fontSize: '13px', textAlign: 'center', marginBottom: '20px' }}>🎉 Cuenta creada con éxito. Regresa al Login para acceder.</div>}
        {hasError && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '13px', textAlign: 'center', marginBottom: '20px' }}>❌ Error al crear la cuenta. Verifica que el número de cuenta o correo no existan.</div>}

        <form action={registrarNuevoUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* 🛠️ NUEVO CAMPO OBLIGATORIO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>No. de Cuenta o Empleado</label>
            <input type="text" name="numero_identificador" placeholder="ej. 314159265" required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#38bdf8', fontSize: '14px', fontWeight: '700', outline: 'none' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>Nombre Completo</label>
            <input type="text" name="nombre" placeholder="ej. Alicia Sánchez" required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#f8fafc', outline: 'none', fontSize: '14px' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>Correo Institucional</label>
            <input type="email" name="email" placeholder="ej. alumno@fes.unam.mx" required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#f8fafc', outline: 'none', fontSize: '14px' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>Contraseña</label>
            <input type="password" name="password" placeholder="••••••••" required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#f8fafc', outline: 'none', fontSize: '14px' }} />
          </div>

          <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '8px', background: '#2563eb', color: 'white', border: 'none', fontWeight: '600', fontSize: '15px', cursor: 'pointer', marginTop: '10px' }}>
            Registrar mi Cuenta
          </button>

          <div style={{ textAlign: 'center', marginTop: '6px' }}>
            <a href="http://localhost:3000" style={{ color: '#38bdf8', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}>¿Ya tienes cuenta? Volver al Login</a>
          </div>
        </form>
      </div>
    </div>
  );
}