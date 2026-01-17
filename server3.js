const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = "smartifi_secret";

// DB connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "smartifi_db",
  port: 3306
});

db.connect(err => {
  if (err) console.error("❌ DB Error:", err);
  else console.log("✅ MySQL Connected");
});

// 🔐 AUTH MIDDLEWARE
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ message: "Invalid token" });
  }
}

// ================= AUTH =================

// LOGIN
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM student WHERE email=? AND password=?",
    [email, password],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "DB error" });
      if (!rows.length) return res.status(401).json({ message: "Invalid credentials" });

      const user = rows[0];
      const token = jwt.sign(
        { student_id: user.student_id, role: "student" },
        JWT_SECRET
      );

      res.json({
        token,
        user: {
          student_id: user.student_id,
          email: user.email,
          name: user.name,
          mac_address: user.mac_address,
          role: "student",
          verified: true,
          plan: null,
          data_usage: 0
        }
      });
    }
  );
});

// SIGNUP (mock activation)
app.post("/api/auth/signup", (req, res) => {
  res.json({ message: "Account activation successful! Please log in." });
});

// VERIFY (mock)
app.post("/api/auth/verify", auth, (req, res) => {
  res.json({ message: "Verified" });
});

// CURRENT USER
app.get("/api/user/me", auth, (req, res) => {
  db.query(
    "SELECT * FROM student WHERE student_id=?",
    [req.user.student_id],
    (err, rows) => {
      if (err || !rows.length) return res.status(401).json({});
      const u = rows[0];
      res.json({
        user: {
          student_id: u.student_id,
          email: u.email,
          name: u.name,
          mac_address: u.mac_address,
          role: "student",
          verified: true,
          plan: "Semester",
          data_usage: 42
        }
      });
    }
  );
});

// ================= DEVICE =================
app.post("/api/device/register", auth, (req, res) => {
  const { studentId, macAddress } = req.body;
  db.query(
    "UPDATE student SET mac_address=? WHERE student_id=?",
    [macAddress, studentId],
    () => res.json({ message: "Device registered" })
  );
});

// ================= PLAN =================
app.post("/api/plan/select", auth, (req, res) => {
  res.json({ message: "Plan selected" });
});

// ================= SPEED TEST =================
app.post("/api/speedtest", auth, (req, res) => {
  const { uploadSpeed, downloadSpeed, latency } = req.body;

  db.query(
    `INSERT INTO speedtest 
     (student_id, upload_speed, download_speed, latency, test_datetime)
     VALUES (?, ?, ?, ?, NOW())`,
    [req.user.student_id, uploadSpeed, downloadSpeed, latency],
    () => res.json({ message: "Speed saved" })
  );
});

// ================= COMPLAINTS =================
app.post("/api/complaints", auth, (req, res) => {
  const { text } = req.body;
  db.query(
    `INSERT INTO complaint 
     (student_id, status, complaint_date, description)
     VALUES (?, 'Pending', CURDATE(), ?)`,
    [req.user.student_id, text],
    () => res.json({ message: "Complaint added" })
  );
});

app.get("/api/complaints", auth, (req, res) => {
  db.query(
    "SELECT description AS text, status, complaint_date AS created_at FROM complaint WHERE student_id=?",
    [req.user.student_id],
    (err, rows) => res.json({ complaints: rows || [] })
  );
});

// ================= START =================
app.listen(4000, () =>
  console.log("🚀 Backend running at http://localhost:4000")
);
