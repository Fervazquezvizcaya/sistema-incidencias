// ms-seguimiento/app/reporte/[id]/page.tsx
import pool from '../../../db';
import { redirect } from 'next/navigation';
import UrlCleaner from './UrlCleaner'; 

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ usuario?: string; step?: string; notasAdmin?: string; modo?: string }>;
}

export default async function DetalleReportePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sParams = await searchParams;
  
  const emailSesion = sParams.usuario;

  if (!emailSesion) {
    redirect('http://localhost:3000');
  }

  const esModoLectura = sParams.modo === 'lectura';
  const comentariosAdmin = sParams.notasAdmin || '';

  let reporte: any = null;
  let nombreUsuarioSesion = 'Personal Técnico'; // Valor por defecto

  try {
    // 1. Validamos que el folio exista en la base de datos
    const [rows]: any = await pool.execute('SELECT * FROM Reporte WHERE id_reporte = ?', [id]);
    if (rows.length > 0) {
      reporte = rows[0];
    }

    // 2. 🔍 Buscamos el nombre real del usuario que tiene abierta la sesión para el registro de auditoría
    const [userRows]: any = await pool.execute('SELECT nombre FROM User WHERE email = ? LIMIT 1', [emailSesion]);
    if (userRows.length > 0) {
      nombreUsuarioSesion = userRows[0].nombre;
    }
  } catch (error) {
    console.error("❌ Error consultando DB en Docker:", error);
  }

  if (!reporte) {
    redirect(`http://localhost:3002?usuario=${encodeURIComponent(emailSesion)}`);
  }

  const currentStep = reporte.estado.toUpperCase(); 

  let descripcionReportero = reporte.descripcion;
  let notasCierreAdmin = comentariosAdmin;

  if (reporte.descripcion && reporte.descripcion.includes(' | NOTAS DE CIERRE: ')) {
    const partes = reporte.descripcion.split(' | NOTAS DE CIERRE: ');
    descripcionReportero = partes[0];
    notasCierreAdmin = partes[1];
  }

  const fechaFormateada = new Date(reporte.fecha_creacion).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  // 🛠️ Server Action 1: Guarda la fecha_atencion y el responsable asignado
  async function iniciarMantenimiento() {
    'use server'
    try {
      await pool.execute(
        'UPDATE Reporte SET estado = ?, fecha_atencion = ?, responsable_assigned = ? WHERE id_reporte = ?', 
        ['EN_PROCESO', new Date(), nombreUsuarioSesion, id]
      );
    } catch (e) {
      console.error("Error al estampar inicio de atención:", e);
    }
    redirect(`/reporte/${id}?usuario=${encodeURIComponent(emailSesion)}&modo=gestion`);
  }

  // 🛠️ Server Action 2: Guarda la fecha_resolucion, el cierre técnico y el responsable final
  async function finalizarMantenimiento(formData: FormData) {
    'use server'
    const notas = formData.get('notas_mantenimiento') as string;
    try {
      const notasCompletas = `${descripcionReportero} | NOTAS DE CIERRE: ${notas}`;
      await pool.execute(
        'UPDATE Reporte SET estado = ?, descripcion = ?, fecha_resolucion = ?, responsable_assigned = ? WHERE id_reporte = ?', 
        ['ATENDIDO', notasCompletas, new Date(), nombreUsuarioSesion, id]
      );
    } catch (e) {
      console.error("Error al estampar cierre técnico:", e);
    }
    redirect(`/reporte/${id}?usuario=${encodeURIComponent(emailSesion)}&modo=gestion&notasAdmin=${encodeURIComponent(notas)}`);
  }

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '40px 20px' }}>
      
      {/* HEADER */}
      <div style={{ maxWidth: '1200px', margin: '0 auto 24px auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href={`http://localhost:3002?usuario=${encodeURIComponent(emailSesion)}`} style={{ textDecoration: 'none', color: '#94a3b8', fontSize: '24px', fontWeight: 'bold' }}>←</a>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#f8fafc' }}>
            Reporte <span style={{ color: '#38bdf8' }}>#R-{reporte.id_reporte}</span>
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* FICHAS DE DETALLE */}
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '32px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <span style={{ backgroundColor: currentStep === 'PENDIENTE' ? 'rgba(239, 68, 68, 0.15)' : currentStep === 'EN_PROCESO' || currentStep === 'PROCESO' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: currentStep === 'PENDIENTE' ? '#fca5a5' : currentStep === 'EN_PROCESO' || currentStep === 'PROCESO' ? '#fef08a' : '#a7f3d0', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', border: '1px solid rgba(255,255,255,0.1)' }}>
              {currentStep === 'PENDIENTE' ? '🔴 Pendiente' : currentStep === 'EN_PROCESO' || currentStep === 'PROCESO' ? '🟡 En Proceso' : '🟢 Atendido'}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>🕒 Creado el {fechaFormateada}</span>
          </div>

          <h2 style={{ color: '#38bdf8', fontSize: '18px', marginBottom: '32px' }}>Detalles de la Solicitud de Mantenimiento</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
            <div><label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>Reportero</label><span style={{ color: '#f8fafc', fontWeight: '600' }}>{reporte.nombre_solicitante}</span></div>
            <div><label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>Fecha</label><span style={{ color: '#f8fafc', fontWeight: '600' }}>{fechaFormateada}</span></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
            <div><label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>Ubicación</label><span style={{ color: '#cbd5e1' }}>🎓 {reporte.tipo_ubicacion}</span></div>
            <div><label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>Aula</label><span style={{ color: '#cbd5e1' }}>{reporte.edificio}, Aula {reporte.aula_especifica}</span></div>
          </div>

          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px' }}>Comentarios</label>
            <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', color: '#cbd5e1', fontSize: '14px', border: '1px solid #334155' }}>"{descripcionReportero}"</div>
          </div>

          {/* BITÁCORA DE CIERRE ACTUALIZADA CON EL NOMBRE DEL TÉCNICO */}
          {currentStep === 'ATENDIDO' && (
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #334155' }}>
              <label style={{ display: 'block', color: '#10b981', fontSize: '11px', textTransform: 'uppercase', marginBottom: '12px', fontWeight: '700' }}>Bitácora de Cierre Técnico</label>
              
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '16px' }}>
                <p style={{ margin: 0, color: '#a7f3d0', fontSize: '14px' }}>
                  <strong>Dictamen final:</strong> {notasCierreAdmin || 'Folio resuelto y cerrado con éxito.'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                {reporte.responsable_assigned && (
                  <span style={{ color: '#cbd5e1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    👨‍🔧 <strong>Atendido y cerrado por:</strong> <span style={{ color: '#38bdf8', fontWeight: '600' }}>{reporte.responsable_assigned}</span>
                  </span>
                )}
                {reporte.fecha_resolucion && (
                  <span style={{ color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ✅ <strong>Fechade cierre:</strong> {new Date(reporte.fecha_resolucion).toLocaleString('es-MX')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA INTELIGENTE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#f8fafc' }}>📋 Control de Estado</h3>
            
            {esModoLectura ? (
              <div style={{ border: '1px solid #334155', borderRadius: '8px', padding: '16px', backgroundColor: '#0f172a', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Seguimiento del reporte</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>Consulta para seguimiento</p>
              </div>
            ) : (
              <>
                {currentStep === 'PENDIENTE' && (
                  <form action={iniciarMantenimiento} style={{ textAlign: 'center' }}>
                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>El reporte está en espera de ser atendido en sitio.</p>
                    <button type="submit" style={{ width: '100%', backgroundColor: '#2563eb', border: 'none', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>🛠️ Atender reporte</button>
                  </form>
                )}

                {(currentStep === 'EN_PROCESO' || currentStep === 'PROCESO') && (
                  <form action={finalizarMantenimiento} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ border: '1px solid #eab308', borderRadius: '8px', padding: '16px', backgroundColor: '#0f172a' }}>
                      <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#fef08a' }}>⚠️ Reporte en reparación activa</p>
                      <textarea name="notas_mantenimiento" placeholder="Escriba las acciones correctivas tomadas..." required rows={3} style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', color: '#f8fafc', fontSize: '13px', resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    </div>
                    <button type="submit" style={{ width: '100%', backgroundColor: '#10b981', border: 'none', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>✓ Finalizar Reporte</button>
                  </form>
                )}

                {currentStep === 'ATENDIDO' && (
                  <div style={{ border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '20px', textAlign: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#a7f3d0', fontWeight: '600' }}>Reporte cerrado</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      <UrlCleaner />
    </div>
  );
}