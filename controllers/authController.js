const db = require('../config/db');

// =========================
// 🧾 REGISTRO
// =========================
exports.registro = (req, res) => {
    const { nombre, correo, telefono, password } = req.body;

    const sql = `
        INSERT INTO Cliente (nombre, correo, contraseña, telefono)
        VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [nombre, correo, password, telefono], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Error al registrar" });
        }

        res.json({ mensaje: "Usuario registrado correctamente" });
    });
};


// =========================
// 🔐 LOGIN
// =========================
exports.login = (req, res) => {
    const { usuario, password } = req.body;

    const sqlCliente = `
        SELECT * FROM Cliente 
        WHERE correo = ? AND contraseña = ?
    `;

    db.query(sqlCliente, [usuario, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Error del servidor" });
        }

        if (results.length > 0) {
            return res.json({ rol: "CLIENTE" });
        }

        const sqlAdmin = `
            SELECT * FROM Admin 
            WHERE correo = ? AND contraseña = ?
        `;

        db.query(sqlAdmin, [usuario, password], (err, resultsAdmin) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Error del servidor" });
            }

            if (resultsAdmin.length > 0) {
                return res.json({ rol: "ADMIN" });
            }

            res.status(401).json({ error: "Credenciales incorrectas" });
        });
    });
};
