const express = require("express");
const path = require("path");
const cors = require("cors");
const { exec }= require("child_process");
const app = express();
const PORT = 5000;   // 🔥 SAME AS FRONTEND
const mysql = require("mysql2");

app.use(cors());
app.use(express.json());


// ===== MIDDLEWARE =====
app.use(cors());                 // 🔥 FIX 1
app.use(express.json());         // 🔥 FIX 2
app.use(express.urlencoded({ extended: true }));

// ===== SERVE FRONTEND =====
app.use(express.static(path.join(__dirname, "public")));
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",          // XAMPP default
  database: "smartifi_db",
  port: 3306
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL connection failed:", err);
  } else {
    console.log("✅ MySQL connected successfully");
  }
});


// ===== TEST API =====
app.get("/api", (req, res) => {
  res.json({ message: "SmartiFi backend working" });
});

// ===== AUTH MOCK APIs =====
app.post("/api/auth/login", (req, res) => {
  res.json({
    token: "dummy-token",
    user: {
      role: "student",
      verified: true,
      student_id: "BT123",
      mac_address: "AA-BB-CC-DD-EE-FF",
      plan: "Semester",
      email: "test@banasthali.in",
      name: "Test Student",
      data_usage: 25
    }
  });
});

app.post("/api/auth/signup", (req, res) => {
  res.json({ message: "Account activated successfully" });
});

app.post("/api/auth/verify", (req, res) => {
  res.json({ success: true });
});

app.get("/api/user/me", (req, res) => {
  res.json({
    user: {
      role: "student",
      verified: true,
      student_id: "BT123",
      mac_address: "AA-BB-CC-DD-EE-FF",
      plan: "Semester",
      email: "test@banasthali.in",
      name: "Test Student",
      data_usage: 25
    }
  });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
app.get("/api/complaints", (req, res) => {
  const sql = `
    SELECT *
    FROM complaint
    ORDER BY complaint_date DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json({ complaints: results });
  });
});


app.post("/api/speedtest", (req, res) => {
  const { downloadSpeed, uploadSpeed, latency } = req.body;

  const studentId = "BT123"; // demo ke liye

  const sql = `
    INSERT INTO speedtest 
    (studentid, uploadSpeed, downloadSpeed, latency)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [studentId, uploadSpeed, downloadSpeed, latency], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json({ message: "Speed test saved" });
  });
});
app.post("/api/complaints", (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ message: "Complaint text required" });
  }

  const sql = `
    INSERT INTO complaint
    (student_id, description, status, complaint_date)
    VALUES (?, ?, ?, NOW())
  `;

  db.query(sql, ["BT123", text, "Pending"], (err) => {
    if (err) {
      console.error("❌ DB ERROR:", err.sqlMessage);
      return res.status(500).json({ message: err.sqlMessage });
    }
    res.json({ message: "Complaint saved successfully" });
  });
});
