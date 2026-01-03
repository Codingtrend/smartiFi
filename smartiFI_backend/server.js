// server.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer'); // <-- ADDED

const app = express();
app.use(cors());
app.use(express.json());

// --- Nodemailer Setup --- (ADDED)
let transporter;
if (process.env.EMAIL_USER) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  console.log('Nodemailer transporter created for Gmail.');
} else {
  console.warn('EMAIL_USER not set. Email verification will not be sent.');
}
// -----------------------------

// --- Database Connection Pool ---
let pool;
try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 10000
    });
    console.log("MySQL Pool created.");

    pool.getConnection()
        .then(connection => {
            console.log('✅ MySQL connected successfully');
            connection.release();
        })
        .catch(err => {
            console.error('❌ MySQL initial connection failed:', err.code, err.message);
        });

} catch (error) {
    console.error("❌ Failed to create MySQL Pool:", error);
    process.exit(1);
}
// -----------------------------


function generateToken(user) {
  return jwt.sign(
      { id: user.id, email: user.email, role: user.role, student_id: user.student_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
  );
}

async function getUserByEmail(email) {
  try {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      return rows[0];
  } catch (dbError) {
      console.error("Database error in getUserByEmail:", dbError);
      throw new Error("Database error retrieving user.");
  }
}

async function getUniversityRecordByEmail(email) {
     try {
        const [rows] = await pool.query('SELECT * FROM university_records WHERE email = ?', [email]);
        return rows[0];
     } catch (dbError) {
        console.error("Database error in getUniversityRecordByEmail:", dbError);
        throw new Error("Database error retrieving university record.");
     }
}


// --- API Endpoints ---

// SIGNUP - Account Activation Flow (MODIFIED)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6 || !email.toLowerCase().endsWith('@banasthali.in')) {
        return res.status(400).json({ message: 'Valid @banasthali.in email and password (min 6 chars) required.' });
    }

    const uniRecord = await getUniversityRecordByEmail(email);
    if (!uniRecord) {
        return res.status(400).json({ message: 'Email not found in university records.' });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser && existingUser.password_hash) {
        return res.status(400).json({ message: 'Account already activated. Please Login.' });
    }

    const hash = await bcrypt.hash(password, 10);
    let userForToken;

    if (existingUser) {
        // UPDATE existing user (activating account)
        // We also reset verified to 0 in case they are re-signing up
        await pool.query('UPDATE users SET password_hash = ?, verified = 0 WHERE email = ?', [hash, email]);
        const [updatedRows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        userForToken = updatedRows[0];
        console.log(`Account password set for ${email}`);
    } else {
        // INSERT new user
        const [result] = await pool.query(
            'INSERT INTO users (email, password_hash, student_id, role, verified) VALUES (?, ?, ?, ?, 0)', // Default verified to 0
            [email, hash, uniRecord.student_id, 'student']
        );
        const [insertedRows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        userForToken = insertedRows[0];
        console.log(`New user account created for ${email}`);
    }

    // --- NEW: Send Verification Email ---
    if (transporter && userForToken) {
        const verifyToken = jwt.sign(
            { id: userForToken.id, email: userForToken.email, purpose: 'verify-email' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' } // Verification link is valid for 1 day
        );
        
        const verifyLink = `${process.env.BASE_URL}/api/auth/verify-email?token=${verifyToken}`;
        
        try {
            await transporter.sendMail({
                from: `"SmartiFI Admin" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'Verify Your SmartiFI Account',
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                        <h2>Welcome to SmartiFI!</h2>
                        <p>Thank you for registering. Please click the link below to verify your email address:</p>
                        <p><a href="${verifyLink}" style="background-color: #3b82f6; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Verify My Account</a></p>
                        <p>If you did not create this account, please ignore this email.</p>
                        <p>This link is valid for 24 hours.</p>
                    </div>
                `
            });
            console.log(`Verification email sent to ${email}`);
        } catch (emailError) {
            console.error(`🔥 Failed to send verification email to ${email}:`, emailError);
            // Don't block signup, but log the error.
        }
    }
    // --- END NEW ---

    // --- MODIFIED SUCCESS RESPONSE ---
    res.status(201).json({
        message: 'Account created! Please check your email to verify your account before logging in.'
    });

  } catch (err) {
    console.error('🔥 Signup Error:', err);
    res.status(500).json({ message: 'Server error during signup.', error: err.message });
  }
});


// LOGIN (MODIFIED)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
     if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required.' });
     }

    const user = await getUserByEmail(email);
    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials.' });
    }

     if (!user.password_hash) {
         return res.status(401).json({ message: 'Account not yet activated. Please Sign Up first.' });
     }

    // --- NEW: Check if user is verified ---
    if (!user.verified) {
        console.log(`Login attempt failed: User ${email} is not verified.`);
        return res.status(401).json({ message: 'Account not verified. Please check your email for the verification link.' });
    }
    // --- END NEW ---

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
        return res.status(401).json({ message: 'Invalid credentials.' });
    }

     const uniRecord = await getUniversityRecordByEmail(email);

    // Login successful
    console.log(`Login successful for ${email}`);
    const token = generateToken(user);
    res.json({
        token,
        user: {
            id: user.id, email: user.email, role: user.role, verified: !!user.verified,
            student_id: user.student_id, mac_address: user.mac_address, plan: user.plan,
            data_usage: user.data_usage, name: uniRecord?.name, course: uniRecord?.course
        }
     });

  } catch (err) {
    console.error('🔥 Login Error:', err);
    res.status(500).json({ message: 'Server error during login.', error: err.message });
  }
});

// Auth Middleware (Remains the same)
async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
      if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ message: 'Unauthorized: Token expired.' });
      }
      console.error("Token verification error:", err.name);
      return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
  }
}

// --- NEW Verification Endpoint (Replaces the old one) ---
// This endpoint is hit when the user clicks the link in their email.
app.get('/api/auth/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).send('<h1>Error</h1><p>Verification token missing.</p>');
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        // Check if token was for this purpose
        if (payload.purpose !== 'verify-email') {
             return res.status(400).send('<h1>Error</h1><p>Invalid token type.</p>');
        }

        // Check if user exists
        const user = await getUserByEmail(payload.email);
        if (!user) {
             return res.status(404).send('<h1>Error</h1><p>User not found.</p>');
        }
        
        // Check if already verified
        if (user.verified) {
            return res.status(200).send('<h1>Account Already Verified</h1><p>Your account is already verified. You can now log in.</p>');
        }

        // Set user as verified
        await pool.query('UPDATE users SET verified = 1 WHERE id = ?', [payload.id]);
        
        console.log(`Account verified for ${payload.email}`);
        
        // Send a success page
        res.send(`
            <div style="font-family: Arial, sans-serif; text-align: center; padding-top: 50px;">
                <h1> Account Verified!</h1>
                <p>Thank you, ${payload.email}. Your account has been successfully verified.</p>
                <p>You can now close this window and log in to the SmartiFI portal.</p>
            </div>
        `);

    } catch (err) {
        console.error('Email Verification Error:', err);
        if (err.name === 'TokenExpiredError') {
            return res.status(400).send('<h1>Error</h1><p>Your verification link has expired. Please try signing up again to receive a new link.</p>');
        }
        return res.status(500).send('<h1>Error</h1><p>An error occurred during verification. Please try again later.</p>');
    }
});
// --- END NEW/REPLACED ENDPOINT ---

// (The old /api/auth/verify endpoint is GONE)


// Device Registration (Remains the same)
app.post('/api/device/register', auth, async (req, res) => {
  try {
    const { studentId, macAddress } = req.body;
     if (!studentId || !macAddress) return res.status(400).json({ message: 'Student ID and MAC Address required.' });
     const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
     if (!macRegex.test(macAddress)) return res.status(400).json({ message: 'Invalid MAC Address format.' });
     const standardizedMac = macAddress.replace(/:/g, '-').toUpperCase();

    const uniRecord = await getUniversityRecordByEmail(req.user.email);
    if (!uniRecord) return res.status(400).json({ message: 'Official student record not found.' });
    if (uniRecord.student_id !== studentId) return res.status(400).json({ message: 'Student ID mismatch.' });

    const [result] = await pool.query( 'UPDATE users SET student_id = ?, mac_address = ? WHERE id = ?', [studentId, standardizedMac, req.user.id] );
    if (result.affectedRows > 0) res.json({ message: 'Device registered successfully.' });
    else res.status(404).json({ message: 'User not found.' });
  } catch (err) {
    console.error('🔥 Device Reg Error:', err);
    res.status(500).json({ message: 'Server error during device registration.', error: err.message });
  }
});


// Select Plan (Remains the same)
app.post('/api/plan/select', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan || (plan !== 'Semester' && plan !== 'Annual')) return res.status(400).json({ message: 'Invalid plan selected.' });
    const [result] = await pool.query('UPDATE users SET plan = ? WHERE id = ?', [plan, req.user.id]);
    if (result.affectedRows > 0) res.json({ message: 'Plan selected successfully.' });
    else res.status(404).json({ message: 'User not found.' });
  } catch (err) {
    console.error('Plan Select Error:', err);
    res.status(500).json({ message: 'Server error during plan selection.', error: err.message });
  }
});

// Get User /me (Remains the same - includes JOIN)
app.get('/api/user/me', auth, async (req, res) => {
 try {
    const [rows] = await pool.query(
        `SELECT u.id, u.email, u.role, u.verified, u.student_id, u.mac_address, u.plan, u.data_usage, ur.name, ur.course
         FROM users u LEFT JOIN university_records ur ON u.email = ur.email WHERE u.id = ?`, [req.user.id] );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });
    const user = { ...rows[0], verified: !!rows[0].verified };
    res.json({ user });
 } catch (err) {
     console.error('Get User Error:', err);
     res.status(500).json({ message: 'Server error fetching user details.', error: err.message });
 }
});


// Complaint Endpoints (Remain the same)
app.get('/api/complaints', auth, async (req, res) => {
    try {
        const [complaints] = await pool.query( 'SELECT id, text, status, created_at FROM complaints WHERE user_id = ? ORDER BY created_at DESC', [req.user.id] );
        res.json({ complaints });
    } catch (err) { console.error('Get Complaints Error:', err); res.status(500).json({ message: 'Server error fetching complaints.', error: err.message }); }
});
app.post('/api/complaints', auth, async (req, res) => {
    try {
        const { text } = req.body; if (!text?.trim()) return res.status(400).json({ message: 'Complaint text required.' });
        const [result] = await pool.query( 'INSERT INTO complaints (user_id, text) VALUES (?, ?)', [req.user.id, text.trim()] );
        const [newComplaint] = await pool.query('SELECT * FROM complaints WHERE id = ?', [result.insertId]);
        res.status(201).json({ message: 'Complaint submitted.', complaint: newComplaint[0] });
    } catch (err) { console.error('Create Complaint Error:', err); res.status(500).json({ message: 'Server error submitting complaint.', error: err.message }); }
});
// -----------------------------


// --- Server Start ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
// --------------------