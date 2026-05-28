// ms-auth/db.ts
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'db', // <- Nombre del servicio en docker-compose
  user: 'root',
  password: 'root',
  database: 'vinculacion_db',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

export default pool;