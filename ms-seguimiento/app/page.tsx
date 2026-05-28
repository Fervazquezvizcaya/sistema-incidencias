// ms-seguimiento/app/page.tsx
import pool from '../db';
import { redirect } from 'next/navigation';
import UrlCleaner from './UrlCleaner'; // 🛠️ Importamos el limpiador de cliente de forma segura

// DIRECTIVA CRÍTICA: Fuerza a Next.js a consultar la DB en vivo dentro de Docker e ignorar el build estático
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ usuario?: string; vista?: string; seccion?: string; successUser?: string; errorUser?: string }>;
}

export default async function SeguimientoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  
  // Capturamos el correo que transfiere el ms-auth. 
  const emailSesion = params.usuario; 
  
  // SEGURIDAD PERIMETRAL: Si entran directo escribiendo el puerto sin loguearse, van al Login
  if (!emailSesion) {
    redirect('http://localhost:3000');
  }

  const vistaActual = params.vista || 'todos';
  const seccionActual = params.seccion || 'dashboard'; 
  const userCreadoExito = params.successUser === 'true';
  const userCreadoError = params.errorUser === 'true';

  let reportes = [];
  let usuariosSistema = [];
  let errorMsg = '';
  let rolUsuario = 'USER'; 
  let nombreRealUsuario = 'Invitado';

  try {
    // 1. Validación relacional de rol por DB (Verificamos que además la cuenta esté ACTIVA para operar)
    const [userRows]: any = await pool.execute(
      `SELECT U.nombre, R.nombre_role, U.activo 
       FROM User U 
       INNER JOIN Role R ON U.id_role = R.id_role 
       WHERE U.email = ? AND U.activo = 1 LIMIT 1`,
      [emailSesion]
    );

    // Si manipulan la URL con un correo falso o suspendido, el sistema los rebota al login
    if (userRows.length > 0) {
      rolUsuario = userRows[0].nombre_role.toUpperCase();
      nombreRealUsuario = userRows[0].nombre;
    } else {
      redirect('http://localhost:3000');
    }

  } catch (error: any) {
    console.error("Error en validación de seguridad:", error);
    if (error.message === 'NEXT_REDIRECT') throw error;
    errorMsg = `Error de conexión con la base de datos de Docker.`;
  }

  const esUsuarioComun = rolUsuario === 'USER';
  const esAdministradorGlobal = rolUsuario === 'ADMIN';

  // Seguridad perimetral de interfaz: Si un USER común intenta forzar secciones de admin, se queda en dashboard
  const secciónEfectiva = esUsuarioComun ? 'dashboard' : seccionActual;

  try {
    // 2. Carga segmentada de datos según la opción elegida en el menú
    if (secciónEfectiva === 'dashboard' || secciónEfectiva === 'gestion') {
      let query = 'SELECT * FROM Reporte';
      const queryParams: any[] = [];

      if (esUsuarioComun) {
        query += ' WHERE nombre_solicitante = ?';
        queryParams.push(nombreRealUsuario);
        if (vistaActual !== 'todos') { query += ' AND estado = ?'; queryParams.push(vistaActual.toUpperCase()); }
      } else {
        if (vistaActual !== 'todos') { query += ' WHERE estado = ?'; queryParams.push(vistaActual.toUpperCase()); }
      }

      query += ' ORDER BY id_reporte DESC';
      const [reportRows]: any = await pool.execute(query, queryParams);
      reportes = reportRows;
    } else if (secciónEfectiva === 'personal') {
      // 🛠️ Traemos el listado completo incluyendo la columna 'activo' para la lógica del baneo
      const [usersList]: any = await pool.execute(
        `SELECT U.id, U.nombre, U.email, R.nombre_role, U.activo 
         FROM User U 
         INNER JOIN Role R ON U.id_role = R.id_role 
         ORDER BY U.id_role ASC, U.nombre ASC`
      );
      usuariosSistema = usersList;
    }
  } catch (error) {
    console.error("Error al cargar datos de sección:", error);
  }

  // KPIs globales calculados en tiempo real
  let todosLosReportes = [];
  try {
    let kpiQuery = 'SELECT estado FROM Reporte';
    const kpiParams: any[] = [];
    if (esUsuarioComun) { kpiQuery += ' WHERE nombre_solicitante = ?'; kpiParams.push(nombreRealUsuario); }
    const [allRows]: any = await pool.execute(kpiQuery, kpiParams);
    todosLosReportes = allRows;
  } catch (e) {}

  const totalReportes = todosLosReportes.length;
  const pendientes = todosLosReportes.filter((r: any) => r.estado === 'PENDIENTE').length;
  const enProceso = todosLosReportes.filter((r: any) => r.estado === 'EN_PROCESO' || r.estado === 'PROCESO').length;
  const atendidos = todosLosReportes.filter((r: any) => r.estado === 'ATENDIDO').length;

  // SERVER ACTION: Alta de usuarios vinculando su ID manual y naciendo activos por defecto (activo = 1)
  async function crearPersonalInstitucional(formData: FormData) {
    'use server'
    const idEmpleadoManual = formData.get('adm_id_empleado') as string; 
    const nombre = formData.get('adm_nombre') as string;
    const email = formData.get('adm_email') as string;
    const password = formData.get('adm_password') as string;
    const id_role = parseInt(formData.get('adm_id_role') as string); 

    let registroCompletado = false;

    try {
      await pool.execute(
        `INSERT INTO User (id, email, nombre, password, id_role, activo) VALUES (?, ?, ?, ?, ?, 1)`,
        [idEmpleadoManual, email, nombre, password, id_role]
      );
      registroCompletado = true;
    } catch (e) {
      console.error("Error al insertar usuario en el sistema:", e);
    }

    if (registroCompletado) {
      redirect(`?usuario=${encodeURIComponent(emailSesion)}&seccion=personal&successUser=true`);
    } else {
      redirect(`?usuario=${encodeURIComponent(emailSesion)}&seccion=personal&errorUser=true`);
    }
  }

  // 🛠️ SERVER ACTION NUEVA: Modifica el bit de estado (1 o 0)
  async function cambiarEstadoUsuario(formData: FormData) {
    'use server'
    const idUsuario = formData.get('userId') as string;
    const estadoActual = parseInt(formData.get('estadoActual') as string);
    
    //REGLA PERIMETRAL: Si intentan alterar al admin por POST directo, lo bloqueamos
    if (idUsuario === '984321') {
      console.warn("Intento bloqueado de desactivar al Administrador.");
      redirect(`?usuario=${encodeURIComponent(emailSesion)}&seccion=personal`);
    }

    // Si está en 1 lo cambiamos a 0 (desactivar), si está en 0 lo subimos a 1 (activar)
    const nuevoEstado = estadoActual === 1 ? 0 : 1;

    try {
      await pool.execute('UPDATE User SET activo = ? WHERE id = ?', [nuevoEstado, idUsuario]);
    } catch (e) {
      console.error("Error cambiando estado del usuario:", e);
    }

    redirect(`?usuario=${encodeURIComponent(emailSesion)}&seccion=personal`);
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a', color: '#f1f5f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* 1. SIDEBAR IZQUIERDO ESTILO FACILITRACK (DARK MODE PROFESIONAL) */}
      <aside style={{ width: '260px', backgroundColor: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', padding: '24px', boxSizing: 'border-box', position: 'fixed', height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ backgroundColor: '#10b981', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px' }}>🎓</div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0', color: '#ffffff' }}>EduInspect</h2>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0 0', fontWeight: '500' }}>FES Aragón</p>
          </div>
        </div>

        {/* NAVEGACIÓN COMPLETA SEGREGADA */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1 }}>
          <label style={{ color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', paddingLeft: '16px', marginBottom: '4px', display: 'block' }}>Vistas y Consulta</label>
          
          <a href={`?usuario=${encodeURIComponent(emailSesion)}&seccion=dashboard`} style={{ textDecoration: 'none' }}>
            <div style={{ padding: '10px 16px', borderRadius: '8px', backgroundColor: secciónEfectiva === 'dashboard' ? 'rgba(16, 185, 129, 0.15)' : 'transparent', color: secciónEfectiva === 'dashboard' ? '#10b981' : '#94a3b8', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              📊 Panel Principal (Lectura)
            </div>
          </a>

          {!esUsuarioComun && (
            <>
              <label style={{ color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', paddingLeft: '16px', marginTop: '14px', marginBottom: '4px', display: 'block' }}>Operación Técnica</label>
              
              <a href={`?usuario=${encodeURIComponent(emailSesion)}&seccion=gestion`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '10px 16px', borderRadius: '8px', backgroundColor: secciónEfectiva === 'gestion' ? 'rgba(56, 189, 248, 0.15)' : 'transparent', color: secciónEfectiva === 'gestion' ? '#38bdf8' : '#94a3b8', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  ⚙️ Gestión Operativa
                </div>
              </a>
            </>
          )}

          {esAdministradorGlobal && (
            <>
              <label style={{ color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', paddingLeft: '16px', marginTop: '14px', marginBottom: '4px', display: 'block' }}>Administración</label>
              <a href={`?usuario=${encodeURIComponent(emailSesion)}&seccion=personal`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '10px 16px', borderRadius: '8px', backgroundColor: secciónEfectiva === 'personal' ? 'rgba(168, 85, 247, 0.15)' : 'transparent', color: secciónEfectiva === 'personal' ? '#a855f7' : '#94a3b8', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  👤 Personal Operativo
                </div>
              </a>
            </>
          )}
        </nav>

        {/* FOOTER DEL SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #334155', paddingTop: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#f8fafc' }}>👋 {nombreRealUsuario}</div>
          <div style={{ fontSize: '11px', color: '#10b981', marginTop: '-8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{rolUsuario}</div>
          <a href="http://localhost:3000" style={{ textDecoration: 'none', color: '#f87171', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>🚪 Cerrar Sesión</a>
        </div>
      </aside>

      {/* 2. AREA DE CONTENIDO PRINCIPAL */}
      <main style={{ flexGrow: 1, marginLeft: '260px', display: 'flex', flexDirection: 'column', minHeight: '100vh', boxSizing: 'border-box' }}>
        
        {/* HEADER SUPERIOR */}
        <header style={{ height: '70px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff', margin: 0 }}>
            {secciónEfectiva === 'dashboard' ? 'Módulo de Consulta de reporte' : secciónEfectiva === 'gestion' ? 'Módulo de gestion de reportes' : 'Control de usuarios'}
          </h1>
          <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>
            Conexión Segura: <span style={{ color: '#ffffff', fontWeight: '600' }}>{emailSesion}</span>
          </div>
        </header>

        {/* VISTAS DE REPORTES (DASHBOARD O GESTIÓN) */}
        {(secciónEfectiva === 'dashboard' || secciónEfectiva === 'gestion') && (
          <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
                <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: '600' }}>Total de Reportes</div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#ffffff', marginTop: '8px' }}>{totalReportes}</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
                <div style={{ fontSize: '13px', color: '#f87171', fontWeight: '600' }}>Acciones Pendientes</div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#f87171', marginTop: '8px' }}>{pendientes}</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
                <div style={{ fontSize: '13px', color: '#fbbf24', fontWeight: '600' }}>En Reparación Activa</div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#fbbf24', marginTop: '8px' }}>{enProceso}</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
                <div style={{ fontSize: '13px', color: '#10b981', fontWeight: '600' }}>Folios Atendidos</div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#10b981', marginTop: '8px' }}>{atendidos}</div>
              </div>
            </div>

            {/* TABLA DE INCIDENCIAS */}
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                <a href={`?usuario=${encodeURIComponent(emailSesion)}&seccion=${secciónEfectiva}&vista=todos`} style={{ textDecoration: 'none' }}><button style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: vistaActual === 'todos' ? '#10b981' : '#334155', color: 'white', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Todas las Ubicaciones</button></a>
                <a href={`?usuario=${encodeURIComponent(emailSesion)}&seccion=${secciónEfectiva}&vista=pendiente`} style={{ textDecoration: 'none' }}><button style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: vistaActual === 'pendiente' ? '#ef4444' : '#334155', color: 'white', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Pendientes</button></a>
                <a href={`?usuario=${encodeURIComponent(emailSesion)}&seccion=${secciónEfectiva}&vista=en_proceso`} style={{ textDecoration: 'none' }}><button style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: vistaActual === 'en_proceso' ? '#d97706' : '#334155', color: 'white', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>En Proceso</button></a>
                <a href={`?usuario=${encodeURIComponent(emailSesion)}&seccion=${secciónEfectiva}&vista=atendido`} style={{ textDecoration: 'none' }}><button style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: vistaActual === 'atendido' ? '#10b981' : '#334155', color: 'white', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Atendidos</button></a>
                
                <a href={`http://localhost:3001?usuario=${encodeURIComponent(emailSesion)}`} style={{ textDecoration: 'none', marginLeft: 'auto' }}>
                  <button style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#10b981', color: 'white', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>➕ Nuevo Reporte</button>
                </a>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                      <th style={{ padding: '14px 16px', fontWeight: '600' }}>ID</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600' }}>REPORTERO</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600' }}>TIPO DE UBICACIÓN</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600' }}>EDIFICIO Y AULA</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600' }}>FECHA REPORTE</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600' }}>FECHA SOLUCIÓN</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' }}>Estado</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600', textAlign: 'center' }}>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportes.map((rep: any) => (
                      <tr key={rep.id_reporte} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '16px', fontWeight: '700', color: '#94a3b8' }}>#{rep.id_reporte}</td>
                        <td style={{ padding: '16px', fontWeight: '600', color: '#f1f5f9' }}>{rep.nombre_solicitante}</td>
                        <td style={{ padding: '16px' }}><span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>{rep.tipo_ubicacion}</span></td>
                        <td style={{ padding: '16px', color: '#cbd5e1' }}>{rep.edificio} — Aula {rep.aula_especifica}</td>
                        <td style={{ padding: '16px', color: '#94a3b8' }}>
                          {new Date(rep.fecha_creacion).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '16px', color: rep.fecha_resolucion ? '#34d399' : '#64748b', fontWeight: rep.fecha_resolucion ? '600' : '400' }}>
                          {rep.fecha_resolucion 
                            ? new Date(rep.fecha_resolucion).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) 
                            : '—'
                          }
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <span style={{ 
                            padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                            backgroundColor: rep.estado === 'PENDIENTE' ? 'rgba(239, 68, 68, 0.15)' : rep.estado === 'EN_PROCESO' || rep.estado === 'PROCESO' ? 'rgba(217, 119, 6, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: rep.estado === 'PENDIENTE' ? '#f87171' : rep.estado === 'EN_PROCESO' || rep.estado === 'PROCESO' ? '#fbbf24' : '#34d399'
                          }}>{rep.estado}</span>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          {secciónEfectiva === 'dashboard' ? (
                            <a href={`/reporte/${rep.id_reporte}?usuario=${encodeURIComponent(emailSesion)}&modo=lectura`} style={{ textDecoration: 'none' }}>
                              <button style={{ backgroundColor: '#1e293b', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>👁️ Ver Reporte</button>
                            </a>
                          ) : (
                            <a href={`/reporte/${rep.id_reporte}?usuario=${encodeURIComponent(emailSesion)}&modo=gestion`} style={{ textDecoration: 'none' }}>
                              <button style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>⚙️ Gestionar</button>
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN DINÁMICA 3: MÓDULO DE PERSONAL AISLADO (CONTROL DE USUARIOS DE ALTA COMPLETA) */}
        {secciónEfectiva === 'personal' && (
          <div style={{ padding: '40px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
            
            {/* TABLA DE PERSONAL */}
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>Usuarios</h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>Cuentas registradas y su rol.</p>
              
              {userCreadoExito && <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>✅ ¡Usuario registrado con éxito!</div>}
              {userCreadoError && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>❌ Hubo un error, asegúrate de que el número de cuenta o correo no se dupliquen.</div>}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                      <th style={{ padding: '12px 16px', fontWeight: '600' }}>ID / NO. CUENTA</th>
                      <th style={{ padding: '12px 16px', fontWeight: '600' }}>NOMBRE COMPLETO</th>
                      <th style={{ padding: '12px 16px', fontWeight: '600' }}>CORREO ELECTRÓNICO</th>
                      <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'center' }}>ROL ASIGNADO</th>
                      {/* AGREGAMOS ENCABEZADO DE ACCIONES */}
                      <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'center' }}>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosSistema.map((usr: any, index: number) => (
                      <tr key={index} style={{ borderBottom: '1px solid #334155', opacity: usr.activo === 0 ? 0.4 : 1 }}>
                        <td style={{ padding: '14px 16px', fontWeight: '700', color: '#38bdf8' }}>{usr.id}</td>
                        <td style={{ padding: '14px 16px', fontWeight: '600', color: '#ffffff' }}>{usr.nombre}</td>
                        <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>{usr.email}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{ 
                            padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                            backgroundColor: usr.nombre_role === 'ADMIN' ? 'rgba(37, 99, 235, 0.2)' : usr.nombre_role === 'MAINTENANCE' ? 'rgba(234, 88, 12, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                            color: usr.nombre_role === 'ADMIN' ? '#60a5fa' : usr.nombre_role === 'MAINTENANCE' ? '#fb923c' : '#34d399'
                          }}>{usr.nombre_role}</span>
                        </td>
                        {/* COLUMNA DE BOTÓN DE DESACTIVACIÓN / ACTIVACIÓN  */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          {usr.id === '984321' ? (
                            <span style={{ 
                              color: '#64748b', 
                              fontSize: '11px', 
                              fontWeight: '700', 
                              textTransform: 'uppercase',
                              backgroundColor: 'rgba(100, 116, 139, 0.1)',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              display: 'inline-block',
                              width: '90px',
                              textAlign: 'center',
                              boxSizing: 'border-box'
                            }}>
                              ADMIN
                            </span>
                          ) : (
                            <form action={cambiarEstadoUsuario}>
                              <input type="hidden" name="userId" value={usr.id} />
                              <input type="hidden" name="estadoActual" value={usr.activo} />
                              <button type="submit" style={{ 
                                backgroundColor: usr.activo === 0 ? '#10b981' : '#c14444', 
                                color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', 
                                fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: '0.2s', width: '90px'
                              }}>
                                {usr.activo === 0 ? 'Activar' : 'Desactivar'}
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FORMULARIO DE ALTA FORMAL */}
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '32px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)', height: 'fit-content' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#ffffff', fontWeight: '700' }}>➕ Registrar Nuevo usuario</h3>
              <p style={{ margin: '4px 0 24px 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>Captura los datos de todos los recuadros</p>
              
              <form action={crearPersonalInstitucional} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>No. Cuenta / Trabajador</label>
                  <input type="text" name="adm_id_empleado" required placeholder="ej. 524103" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#38bdf8', fontSize: '13px', fontWeight: '700', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>Nombre Completo</label>
                  <input type="text" name="adm_nombre" required placeholder="ej. Ing. Carlos Mendoza" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>Correo Electrónico</label>
                  <input type="email" name="adm_email" required placeholder="ej. tecnico@fes.unam.mx" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>Contraseña</label>
                  <input type="password" name="adm_password" required placeholder="••••••••" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>Rol</label>
                  <select name="adm_id_role" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white', fontSize: '13px', outline: 'none' }}>
                    <option value="2">🛠️ Mantenimiento Técnico</option>
                    <option value="1">⚡ Administrador</option>
                    <option value="3">👤 Usuario</option>
                  </select>
                </div>
                <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#10b981', color: 'white', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer', marginTop: '8px' }}>
                  Registrar Personal
                </button>
              </form>
            </div>

          </div>
        )}

      </main>

      <UrlCleaner />
    </div>
  );
}