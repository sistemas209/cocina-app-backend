const express = require("express");
const cors = require("cors");
const db = require("./configuracion/db");

const app = express();

app.use(cors({ origin: "*", credentials: false }));
app.use(express.json());

// ============================================================
// 🔐 LOGIN
// ============================================================
app.post("/login", (req, res) => {
    const { usuario, password } = req.body;

    const sqlAdmin = "SELECT * FROM Admin WHERE correo = ? AND contraseña = ?";
    db.query(sqlAdmin, [usuario, password], (err, results) => {
        if (err) return res.status(500).json({ error: "Error en servidor" });

        if (results.length > 0) {
            return res.json({ rol: "ADMIN", nombre: results[0].nombre });
        }

        const sqlCliente = "SELECT * FROM Cliente WHERE correo = ? AND contraseña = ?";
        db.query(sqlCliente, [usuario, password], (err, clientResults) => {
            if (err) return res.status(500).json({ error: "Error en servidor" });

            if (clientResults.length > 0) {
                return res.json({
                    rol: "CLIENTE",
                    nombre: clientResults[0].nombre,
                    id: clientResults[0].id_cliente
                });
            }

            const sqlEmpleado = "SELECT * FROM Empleado WHERE correo = ? AND contraseña = ?";
            db.query(sqlEmpleado, [usuario, password], (err, empResults) => {
                if (err) return res.status(500).json({ error: "Error en servidor" });

                if (empResults.length > 0) {
                    return res.json({ rol: empResults[0].rol, nombre: empResults[0].nombre });
                }

                return res.status(401).json({ error: "Credenciales incorrectas" });
            });
        });
    });
});

// ============================================================
// 📝 REGISTRO
// ============================================================
app.post("/registro", (req, res) => {
    const { usuario, nombre, correo, password, telefono } = req.body;

    const sqlCheck = "SELECT * FROM Cliente WHERE correo = ?";
    db.query(sqlCheck, [correo], (err, existing) => {
        if (err) return res.status(500).json({ error: "Error en servidor" });
        if (existing.length > 0) return res.status(400).json({ error: "El correo ya está registrado" });

        const sql = "INSERT INTO Cliente (nombre, correo, contraseña, telefono) VALUES (?, ?, ?, ?)";
        db.query(sql, [nombre, correo, password, telefono], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Error al registrar usuario" });
            }
            res.json({ mensaje: "Registro exitoso", id: result.insertId });
        });
    });
});

// ============================================================
// 🍔 MENÚ — trae todos los productos disponibles (clientes)
// ============================================================
app.get("/menu", (req, res) => {
    const sql = "SELECT * FROM Producto WHERE disponible = 1";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: "Error al obtener menú" });
        res.json(results);
    });
});

// ============================================================
// 🍔 MENÚ ADMIN — trae TODOS los productos (con y sin descuento)
// ============================================================
app.get("/admin/productos", (req, res) => {
    const sql = "SELECT * FROM Producto ORDER BY id_producto ASC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: "Error al obtener productos" });
        res.json(results);
    });
});

// ============================================================
// ✏️ ACTUALIZAR PRECIO DE UN PRODUCTO
// ============================================================
app.put("/admin/producto/:id/precio", (req, res) => {
    const id = req.params.id;
    const { precio } = req.body;

    if (!precio || isNaN(precio) || precio <= 0) {
        return res.status(400).json({ error: "Precio inválido" });
    }

    const sql = "UPDATE Producto SET precio = ? WHERE id_producto = ?";
    db.query(sql, [precio, id], (err) => {
        if (err) return res.status(500).json({ error: "Error al actualizar precio" });
        res.json({ mensaje: "Precio actualizado correctamente" });
    });
});

// ============================================================
// 🏷️ APLICAR DESCUENTO A UN PRODUCTO
// El descuento se guarda como el nuevo precio rebajado.
// Se guarda el precio original en un campo aparte si existe,
// o simplemente se actualiza el precio con el descuento aplicado.
// ============================================================
app.put("/admin/producto/:id/descuento", (req, res) => {
    const id = req.params.id;
    const { descuento } = req.body; // porcentaje: ej. 10 = 10%

    if (descuento === undefined || isNaN(descuento) || descuento < 0 || descuento > 100) {
        return res.status(400).json({ error: "Descuento inválido (debe ser 0-100)" });
    }

    // Primero obtenemos el precio actual
    db.query("SELECT precio FROM Producto WHERE id_producto = ?", [id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ error: "Producto no encontrado" });

        const precioActual = parseFloat(results[0].precio);
        const precioConDescuento = Math.round(precioActual * (1 - descuento / 100));

        db.query("UPDATE Producto SET precio = ? WHERE id_producto = ?", [precioConDescuento, id], (err2) => {
            if (err2) return res.status(500).json({ error: "Error al aplicar descuento" });
            res.json({
                mensaje: `Descuento de ${descuento}% aplicado`,
                precioAnterior: precioActual,
                precioNuevo: precioConDescuento
            });
        });
    });
});

// ============================================================
// 🔄 CAMBIAR DISPONIBILIDAD DE PRODUCTO (activar/desactivar)
// ============================================================
app.put("/admin/producto/:id/disponibilidad", (req, res) => {
    const id = req.params.id;
    const { disponible } = req.body; // 1 o 0

    const sql = "UPDATE Producto SET disponible = ? WHERE id_producto = ?";
    db.query(sql, [disponible, id], (err) => {
        if (err) return res.status(500).json({ error: "Error al cambiar disponibilidad" });
        res.json({ mensaje: disponible ? "Producto activado" : "Producto desactivado" });
    });
});

// ============================================================
// 🛒 CREAR PEDIDO
// ============================================================
app.post("/pedido", (req, res) => {
    const { id_cliente, items, total } = req.body;

    const sqlPedido = "INSERT INTO Pedido (id_cliente, total, estado) VALUES (?, ?, 'pendiente')";
    db.query(sqlPedido, [id_cliente, total], (err, result) => {
        if (err) return res.status(500).json({ error: "Error al crear pedido" });

        const id_pedido = result.insertId;

        if (items && items.length > 0) {
            const sqlItems = "INSERT INTO DetallePedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES ?";
            const valores = items.map(i => [id_pedido, i.id_producto, i.cantidad, i.precio]);
            db.query(sqlItems, [valores], (err2) => {
                if (err2) console.error("Error insertando items:", err2);
            });
        }

        res.json({ mensaje: "Pedido recibido", id_pedido });
    });
});

// ============================================================
// 📋 OBTENER TODOS LOS PEDIDOS (cocina / admin)
// ============================================================
app.get("/pedidos", (req, res) => {
    const sql = `
        SELECT p.id_pedido, p.total, p.estado, p.fecha,
               c.nombre AS cliente
        FROM Pedido p
        LEFT JOIN Cliente c ON p.id_cliente = c.id_cliente
        ORDER BY p.fecha DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: "Error al obtener pedidos" });
        res.json(results);
    });
});

// ============================================================
// 📋 PEDIDOS CON DETALLE DE PRODUCTOS (para cocina)
// ============================================================
app.get("/pedidos-detalle", (req, res) => {
    const sqlPedidos = `
        SELECT p.id_pedido, p.total, p.estado, p.fecha,
               c.nombre AS cliente
        FROM Pedido p
        LEFT JOIN Cliente c ON p.id_cliente = c.id_cliente
        ORDER BY p.fecha DESC
    `;
    db.query(sqlPedidos, (err, pedidos) => {
        if (err) return res.status(500).json({ error: "Error al obtener pedidos" });

        if (pedidos.length === 0) return res.json([]);

        let completados = 0;
        const resultados = [];

        pedidos.forEach((pedido, i) => {
            const sqlItems = `
                SELECT dp.cantidad, pr.nombre
                FROM DetallePedido dp
                LEFT JOIN Producto pr ON dp.id_producto = pr.id_producto
                WHERE dp.id_pedido = ?
            `;
            db.query(sqlItems, [pedido.id_pedido], (err2, items) => {
                resultados[i] = { ...pedido, items: items || [] };
                completados++;
                if (completados === pedidos.length) {
                    res.json(resultados);
                }
            });
        });
    });
});

// ============================================================
// ✅ MARCAR PEDIDO COMO TERMINADO
// ============================================================
app.put("/pedido/:id", (req, res) => {
    const id = req.params.id;
    const sql = "UPDATE Pedido SET estado = 'terminado' WHERE id_pedido = ?";
    db.query(sql, [id], (err) => {
        if (err) return res.status(500).json({ error: "Error al actualizar pedido" });
        res.json({ mensaje: "Pedido marcado como terminado" });
    });
});

// ============================================================
// 👥 CREAR EMPLEADO
// ============================================================
app.post("/empleado", (req, res) => {
    const { numEmpleado, nombre, correo, rol, password } = req.body;

    const sqlCheck = "SELECT * FROM Empleado WHERE correo = ?";
    db.query(sqlCheck, [correo], (err, existing) => {
        if (err) return res.status(500).json({ error: "Error en servidor" });
        if (existing.length > 0) return res.status(400).json({ error: "El correo ya está registrado" });

        const sql = "INSERT INTO Empleado (num_empleado, nombre, correo, contraseña, rol) VALUES (?, ?, ?, ?, ?)";
        db.query(sql, [numEmpleado, nombre, correo, password, rol], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Error al registrar empleado" });
            }
            res.json({ mensaje: "Empleado registrado", id: result.insertId });
        });
    });
});

// ============================================================
// 👥 OBTENER EMPLEADOS
// ============================================================
app.get("/empleados", (req, res) => {
    const sql = "SELECT id_empleado, num_empleado, nombre, correo, rol FROM Empleado";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: "Error al obtener empleados" });
        res.json(results);
    });
});

// ============================================================
// 🗑 ELIMINAR EMPLEADO
// ============================================================
app.delete("/empleado/:id", (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM Empleado WHERE id_empleado = ?";
    db.query(sql, [id], (err) => {
        if (err) return res.status(500).json({ error: "Error al eliminar empleado" });
        res.json({ mensaje: "Empleado eliminado" });
    });
});

// ============================================================
// 📊 ESTADÍSTICAS PARA DASHBOARD ADMIN
// ============================================================
app.get("/stats", (req, res) => {
    const stats = {};

    db.query("SELECT COUNT(*) AS total FROM Cliente", (err, r1) => {
        if (err) return res.status(500).json({ error: "Error" });
        stats.clientes = r1[0].total;

        db.query("SELECT COUNT(*) AS total FROM Pedido WHERE estado = 'pendiente'", (err, r2) => {
            if (err) return res.status(500).json({ error: "Error" });
            stats.pedidosPendientes = r2[0].total;

            db.query("SELECT COUNT(*) AS total FROM Pedido", (err, r3) => {
                if (err) return res.status(500).json({ error: "Error" });
                stats.pedidosTotales = r3[0].total;

                db.query("SELECT IFNULL(SUM(total), 0) AS total FROM Pedido WHERE estado = 'terminado'", (err, r4) => {
                    if (err) return res.status(500).json({ error: "Error" });
                    stats.ingresos = r4[0].total;
                    res.json(stats);
                });
            });
        });
    });
});

app.listen(3000, () => {
    console.log("🚀 Servidor corriendo en http://localhost:3000");
});
