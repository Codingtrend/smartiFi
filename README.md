SmartiFI - Banasthali Vidyapeeth WiFi Digitalisation

1. Overview

Welcome to the SmartiFI project! This application provides a portal for students at Banasthali Vidyapeeth to register for and manage their WiFi access.

This project consists of two main parts:

Backend (server.js): A Node.js and Express server that handles user authentication, device registration, plan selection, and complaints. It connects to a MySQL database.

Frontend (index3.html): A single-page application built with vanilla JavaScript and Tailwind CSS. It interacts with the backend API.

This guide will walk you through the complete setup to get the project running on your local machine.

2. Prerequisites

Before you begin, ensure you have the following software installed on your computer:

Git: For cloning the project repository.

Node.js: (LTS version recommended). This will also install npm.

[suspicious link removed]: The database for the application.

A MySQL Client: A tool to manage your database.

phpMyAdmin (as seen in the project screenshots)

MySQL Workbench

Or any other client you prefer.

3. A-to-Z Setup Instructions

Follow these steps in order to get the application running.

Step 1: Clone the Repository

Open your terminal or command prompt.

Clone the project from GitHub (replace the URL with your actual repository URL):

git clone [https://github.com/your-username/your-repository-name.git](https://github.com/your-username/your-repository-name.git)


Navigate into the newly cloned project directory:

cd your-repository-name


Step 2: Install Backend Dependencies

Install all the required Node.js packages listed in package.json:

npm install


Step 3: Set Up the MySQL Database

This is the most critical step. You need to create the database and the tables that the server (server.js) expects.

Start your MySQL server and log in using your MySQL client (e.g., phpMyAdmin, Workbench).

Create the database. The name must be smartifi_db as defined in the .env file.

CREATE DATABASE smartifi_db;


Use the new database:

USE smartifi_db;


Run the following SQL commands to create all the necessary tables:

-- Create the 'users' table
-- This table stores login info, plan, and device details.
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  `role` VARCHAR(50) DEFAULT 'student',
  verified TINYINT(1) DEFAULT 0,
  student_id VARCHAR(100),
  mac_address VARCHAR(100),
  `plan` VARCHAR(50),
  data_usage DECIMAL(10, 2) DEFAULT 0.00
);

-- Create the 'university_records' table
-- This table acts as a pre-approved list of students.
-- A user can ONLY sign up if their email is in this table.
CREATE TABLE university_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  student_id VARCHAR(100),
  `name` VARCHAR(255),
  course VARCHAR(255)
);

-- Create the 'complaints' table
-- This table stores support tickets submitted by users.
CREATE TABLE complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  `text` TEXT,
  `status` VARCHAR(50) DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


(Optional but Recommended) Add dummy data to the university_records table. This is required to test the sign-up process.

INSERT INTO university_records (email, student_id, name, course)
VALUES
('student@banasthali.in', 'B2023CSE001', 'Priya Sharma', 'B.Tech (CSE)'),
('anju.verma@banasthali.in', 'B2022ELE002', 'Anju Verma', 'B.Tech (Electrical)'),
('meena.rani@banasthali.in', 'B2023MBA002', 'Meena Rani', 'MBA');


Step 4: Configure Environment Variables

The server needs a .env file to connect to the database and use other services.

In the root of the project directory, create a new file named .env.

Copy and paste the following content into your new .env file.

You must fill in the missing values.

# --- Server Port ---
PORT=4000

# --- Database Connection ---
# !! IMPORTANT !!
# Change these to match YOUR local MySQL setup.
# The port is 3307 in the original file, but the default is 3306.
DB_HOST=localhost
DB_PORT=3307 
DB_USER=root
DB_PASS=
DB_NAME=smartifi_db

# --- Security ---
# !! Generate your own secret !!
# Use a random string generator.
JWT_SECRET=!!_REPLACE_THIS_WITH_YOUR_OWN_LONG_RANDOM_SECRET_!!

# --- Nodemailer (Email Verification) ---
# !! You MUST use your own Gmail account for testing !!
BASE_URL=http://localhost:4000
EMAIL_USER=your-email@gmail.com

# !! IMPORTANT: USE A "GOOGLE APP PASSWORD" !!
# 1. Go to your Google Account -> Security
# 2. Enable 2-Step Verification
# 3. Go to "App Passwords", create a new one for "Mail"
# 4. Use the 16-character password it gives you here.
EMAIL_PASS=!!_REPLACE_THIS_WITH_YOUR_16_CHAR_GOOGLE_APP_PASSWORD_!!


Step 5: Run the Application!

You are all set!

Start the Backend Server:
Open a terminal in the project root and run:

node server.js


You should see messages like:

MySQL Pool created.
Nodemailer transporter created for Gmail.
Server running on http://localhost:4000
✅ MySQL connected successfully


Open the Frontend:
In your file explorer, find the index3.html file and open it in your web browser (e.g., by double-clicking it).

4. How to Use the App (Testing)

Sign Up: Use one of the emails you added to the university_records table (e.g., student@banasthali.in) and a new password.

Verify Account: The backend is designed to send a verification email. Since this is a local setup, the server.js file has a simulated verification on the "Check Your Email" page. The handleEmailVerification function in the HTML does not use the token from the email, it just makes a POST to /api/auth/verify which is now gone.

Note: The new server.js (from your upload) sends a real email with a token (/api/auth/verify-email?token=...). You must check your Gmail inbox for the email sent to student@banasthali.in (or whichever email you used) and click the link in that email. This will open http://localhost:4000/api/auth/verify-email?token=... in your browser and verify the account.

Log In: After verifying, go back to index3.html and log in with the same email and password.

Register Device: You will be routed to the Device Registration page.

Enter the student_id associated with the email (e.g., B2023CSE001).

Enter a valid MAC address (e.g., 00:1A:2B:3C:4D:5E).

Select Plan: You will be routed to the plan selection page. Choose a plan.

Dashboard: You should now land on the main student dashboard.

You are now fully set up and can start developing!
