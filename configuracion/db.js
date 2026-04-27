const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Vacío por ser XAMPP
  database: 'restaurante'
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Error al conectar con MySQL: ' + err.message);
    return;
  }
  console.log('✅ Conexión exitosa con la base de datos.');
});

module.exports = connection;
