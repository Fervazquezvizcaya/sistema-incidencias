// init-db.js (Ubicado en la raíz del proyecto)
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost', // Conexión desde Windows al puerto expuesto de Docker
  user: 'root',
  password: 'root',
  database: 'vinculacion_db',
  port: 3306
});

connection.connect(err => {
  if (err) {
    console.error('Error conectando a MySQL:', err.message);
    return;
  }
  console.log('Conectado a MySQL local desde Windows.');

  // 1. CREAR TABLA CATÁLOGO DE ROLES (BANDERAS 1, 2, 3)
  connection.query(`CREATE TABLE IF NOT EXISTS Role (
    id_role INT PRIMARY KEY,
    nombre_role VARCHAR(50) NOT NULL
  )`, (err) => {
    if (err) console.error('Error al crear tabla Role:', err.message);
  });

  // 2. VERIFICAR O CREAR TABLA DE USUARIOS (CON ESTRUCTURA INTEGRAL)
  connection.query(`CREATE TABLE IF NOT EXISTS User (
    id VARCHAR(36) PRIMARY KEY, -- Aquí se almacena directamente el No. de Cuenta o Empleado escrito manual
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    id_role INT NOT NULL,
    activo TINYINT DEFAULT 1 -- 🛠️ 1 = Cuenta Activa, 0 = Cuenta Desactivada / Bloqueada
  )`, (err) => {
    if (err) {
      console.error('Error al verificar/crear tabla User normalizada:', err.message);
    } else {
      // Inyectamos el catálogo de roles y usuarios fijos de manera limpia
      insertarUsuariosYRoles();
    }
  });

  // 3. VERIFICAR O CREAR TABLA REPORTE (CONSERVA TUS DATOS)
  connection.query(`CREATE TABLE IF NOT EXISTS Reporte (
    id_reporte INT AUTO_INCREMENT PRIMARY KEY,
    fecha_creacion DATETIME NOT NULL,
    nombre_solicitante VARCHAR(50) NOT NULL,
    tipo_ubicacion VARCHAR(50) NOT NULL,
    edificio VARCHAR(50) NOT NULL,
    aula_especifica VARCHAR(50) NOT NULL,
    descripcion VARCHAR(200) NOT NULL,
    estado VARCHAR(50) NOT NULL,
    responsable_assigned VARCHAR(50) NULL,
    notes_tecnico VARCHAR(200) NULL,
    fecha_atencion DATETIME NULL,
    fecha_resolucion DATETIME NULL,
    evaluacion VARCHAR(50) NULL
  )`, (err) => {
    if (err) {
      console.error('Error al verificar/crear tabla Reporte:', err.message);
    } else {
      console.log('La tabla Reporte está verificada (se conservan los datos existentes).');
      
      // Validamos si la tabla está vacía para inyectar los datos iniciales por única vez
      verificarEInyectarReportesIniciales();
    }
  });
});

function insertarUsuariosYRoles() {
  // Inyectar el catálogo estático de roles de tu UML
  connection.query(`INSERT IGNORE INTO Role (id_role, nombre_role) VALUES 
    (1, 'ADMIN'), 
    (2, 'MAINTENANCE'), 
    (3, 'USER')`);

  // Los inserts usan INSERT IGNORE y ahora mapean explícitamente el estado inicial 'activo = 1'
  connection.query(`INSERT IGNORE INTO User (id, email, nombre, password, id_role, activo) VALUES
    ('984321', 'admin@fes.unam.mx', 'Fernando Vázquez', '123', 1, 1)`); // No. Empleado Admin (Tú)

  connection.query(`INSERT IGNORE INTO User (id, email, nombre, password, id_role, activo) VALUES
    ('524103', 'tecnico@fes.unam.mx', 'Carlos Mendoza', '123', 2, 1)`); // No. Empleado Técnico

  connection.query(`INSERT IGNORE INTO User (id, email, nombre, password, id_role, activo) VALUES
    ('314159265', 'alumno@fes.unam.mx', 'Alicia Sánchez', '123', 3, 1)`); // No. Cuenta Alumno

  console.log('👥 Catálogo de Roles y Usuarios base verificados/actualizados en MySQL.');
}

function verificarEInyectarReportesIniciales() {
  connection.query('SELECT COUNT(*) AS total FROM Reporte', (err, rows) => {
    if (!err && rows && rows[0] && rows[0].total === 0) {
      console.log('📝 La tabla de reportes está vacía. Inyectando datos iniciales...');
      
      const queryReporte = `INSERT INTO Reporte 
        (fecha_creacion, nombre_solicitante, tipo_ubicacion, edificio, aula_especifica, descripcion, estado) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`;

      connection.query(queryReporte, [new Date(), 'Juan Pérez', 'Aulas', 'Ala de Ciencias', 'Aula 402B', 'Falla eléctrica en los contactos del ala norte.', 'PENDIENTE']);
      connection.query(queryReporte, [new Date(), 'Alicia Sánchez', 'Baños', 'Complejo Deportivo', 'Baño de Varones 2', 'Fuga de agua persistente en la llave del lavabo central.', 'PENDIENTE']);
    } else if (!err && rows && rows[0]) {
      console.log(`Ya existen ${rows[0].total} reportes en la base de datos. Conservando tu información.`);
    }
    
    connection.end();
  });
}