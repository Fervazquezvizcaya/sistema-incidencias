// ms-registro/app/page.tsx
import { redirect } from 'next/navigation';
import pool from '../db';
import UrlCleaner from './UrlCleaner'; // 🛠️ Importamos el limpiador de cliente de forma segura

// 🚨 DIRECTIVA CRÍTICA: Fuerza a Next.js a consultar la DB en vivo dentro de Docker e ignorar la caché estática
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string; usuario?: string }>;
}

export default async function RegistroPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isSuccess = params.success === 'true';
  const hasError = params.error === 'true';
  
  // 🔐 Capturamos el correo institucional heredado del ms-auth / ms-seguimiento
  const emailSesion = params.usuario;

  // 🛡️ SEGURIDAD PERIMETRAL: Si intentan saltarse el Login pegando el puerto 3001 directo, van para atrás
  if (!emailSesion) {
    redirect('http://localhost:3000');
  }

  let nombreReportero = 'Invitado Institucional';
  let identificadorOficial = '000000000'; 

  try {
    // 🔍 CONSULTA REAL A MYSQL: Validamos que el correo exista en Docker y jalamos sus datos oficiales
    const [userRows]: any = await pool.execute(
      'SELECT nombre, id FROM User WHERE email = ? LIMIT 1',
      [emailSesion]
    );

    // Si el correo no existe en la base de datos, significa que alteraron la URL manualmente; los rebotamos
    if (userRows.length > 0) {
      nombreReportero = userRows[0].nombre;
      identificadorOficial = userRows[0].id; 
    } else {
      redirect('http://localhost:3000');
    }
  } catch (error: any) {
    // Si la excepción es una redirección provocada por Next.js, la dejamos pasar para que actúe el middleware
    if (error.message === 'NEXT_REDIRECT') throw error;
    console.error("❌ Error al recuperar credenciales del reportero:", error);
  }

  async function crearReporte(formData: FormData) {
    'use server'
    
    const nombre_solicitante = formData.get('nombre_solicitante') as string;
    const tipo_ubicacion = formData.get('tipo_ubicacion') as string;
    const edificio = formData.get('edificio') as string;
    const aula_especifica = formData.get('aula_especifica') as string;
    const descripcion = formData.get('descripcion') as string;

    let insertoConExito = false;

    try {
      // Guardamos el reporte amarrado al nombre validado por la DB
      await pool.execute(
        `INSERT INTO Reporte 
        (fecha_creacion, nombre_solicitante, tipo_ubicacion, edificio, aula_especifica, descripcion, estado) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [new Date(), nombre_solicitante, tipo_ubicacion, edificio, aula_especifica, descripcion, 'PENDIENTE']
      );
      insertoConExito = true;
    } catch (error: any) {
      console.error("❌ ERROR REAL EN MYSQL DE DOCKER:", error.message || error);
      insertoConExito = false;
    }

    // Redirecciones seguras afuera del try/catch
    if (insertoConExito) {
      redirect(`http://localhost:3001?success=true&usuario=${encodeURIComponent(emailSesion)}`);
    } else {
      redirect(`http://localhost:3001?error=true&usuario=${encodeURIComponent(emailSesion)}`);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '20px' }}>
      <div style={{ backgroundColor: '#1e293b', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)', width: '100%', maxWidth: '550px', border: '1px solid #334155' }}>
        
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0', color: '#38bdf8' }}>
            Reportes — FES Aragón
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0' }}>
            Nuevo Reporte de Instalaciones
          </p>
        </div>

        {isSuccess && (
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#a7f3d0', padding: '12px', borderRadius: '8px', fontSize: '14px', textAlign: 'center', marginBottom: '20px' }}>
            ¡Reporte guardado exitosamente!
          </div>
        )}

        {hasError && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '14px', textAlign: 'center', marginBottom: '20px' }}>
            Ocurrió un error al intentar guardar el reporte.
          </div>
        )}

        <form action={crearReporte} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 👥 DATOS DE IDENTIDAD RELACIONAL (CAMPOS PROTEGIDOS) */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '2', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>Nombre del Reportero</label>
              <input 
                type="text" 
                name="nombre_solicitante" 
                value={nombreReportero} 
                readOnly 
                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', fontSize: '15px', outline: 'none', cursor: 'not-allowed' }} 
              />
            </div>

            {/* Muestra de forma automática su No. de cuenta / ID desde la DB */}
            <div style={{ flex: '1', minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>No. Cuenta / Empleado</label>
              <input 
                type="text" 
                value={identificadorOficial} 
                readOnly 
                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#38bdf8', fontSize: '15px', fontWeight: '700', textAlign: 'center', outline: 'none', cursor: 'not-allowed' }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>Tipo de Ubicación</label>
              <select name="tipo_ubicacion" required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#f8fafc', outline: 'none' }}>
                <option value="Aulas">Aulas</option>
                <option value="Baños">Baños</option>
                <option value="Laboratorios">Laboratorios</option>
                <option value="Áreas Comunes">Áreas Comunes</option>
              </select>
            </div>

            <div style={{ flex: '1', minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>Edificio</label>
              <input type="text" name="edificio" placeholder="ej. Ala de Ciencias" required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#f8fafc', outline: 'none' }} />
            </div>

            <div style={{ flex: '1', minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>Aula / Sección</label>
              <input type="text" name="aula_especifica" placeholder="ej. Aula 402B" required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#f8fafc', outline: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: '500' }}>Notas Detalladas del Problema</label>
            <textarea name="descripcion" rows={4} placeholder="Describa cualquier problema, reparaciones necesarias o estado general..." required style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#f8fafc', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <a href={`http://localhost:3002?usuario=${encodeURIComponent(emailSesion)}`} style={{ flex: '1', padding: '14px', borderRadius: '8px', backgroundColor: '#334155', color: '#cbd5e1', border: '1px solid #475569', fontWeight: '600', fontSize: '15px', textDecoration: 'none', textAlign: 'center' }}>
              Volver al Panel
            </a>
            <button type="submit" style={{ flex: '1', padding: '14px', borderRadius: '8px', background: '#10b981', color: 'white', border: 'none', fontWeight: '600', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
              Enviar Reporte
            </button>
          </div>
        </form>

      </div>

      {/* 🛡️ INYECTAMOS EL LIMPIADOR DESDE SU ARCHIVO SEPARADO DE CLIENTE */}
      <UrlCleaner />
    </div>
  );
}