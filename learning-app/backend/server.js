const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || "mysql",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "todos",
  waitForConnections: true,
  connectionLimit: 5,
});

// MySQL can take a while to start in k8s, so retry until it is reachable.
async function initDb() {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS todos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          done BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      console.log("Database ready");
      return;
    } catch (err) {
      console.log(`DB not ready (attempt ${attempt}): ${err.code || err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", pod: process.env.HOSTNAME });
  } catch (err) {
    res.status(503).json({ status: "db unavailable" });
  }
});

app.get("/api/todos", async (_req, res) => {
  const [rows] = await pool.query("SELECT * FROM todos ORDER BY id DESC");
  res.json(rows);
});

app.post("/api/todos", async (req, res) => {
  const title = (req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "title is required" });
  const [result] = await pool.query("INSERT INTO todos (title) VALUES (?)", [title]);
  res.status(201).json({ id: result.insertId, title, done: false });
});

app.put("/api/todos/:id/toggle", async (req, res) => {
  await pool.query("UPDATE todos SET done = NOT done WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.delete("/api/todos/:id", async (req, res) => {
  await pool.query("DELETE FROM todos WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend listening on ${port}`));
initDb();
