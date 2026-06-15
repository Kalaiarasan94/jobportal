import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// XAMPP Default MySQL Connection Pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',         
  password: '', // Kept blank/empty for standard XAMPP configurations
  database: 'meta_form_db' 
});

// 1. PUBLIC ROUTE: Save candidate submissions with both merged address & separate city
app.post('/api/register-candidate', async (req, res) => {
  const { full_name, email, phone, city, address, qualification_college } = req.body;
  try {
    await pool.query(
      'INSERT INTO job_applications (full_name, email, phone, city, address, qualification_college) VALUES (?, ?, ?, ?, ?, ?)',
      [full_name, email, phone, city, address, qualification_college]
    );
    res.status(201).json({ success: true, message: 'Application saved successfully' });
  } catch (error) {
    console.error('MySQL Insert Error:', error);
    res.status(500).json({ success: false, error: 'Database error saving applicant' });
  }
});

// 2. ADMIN ROUTE: Handle secure admin credentials verification
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'hrpass123') {
    res.status(200).json({ success: true, message: 'Authenticated successfully' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// 3. ADMIN ROUTE: Get metrics counts and the last 5 applicants for the dashboard feed
app.get('/api/admin/stats', async (req, res) => {
  try {
    const [countRows]: any = await pool.query('SELECT COUNT(*) as total FROM job_applications');
    const [latestRows]: any = await pool.query('SELECT full_name, email, submitted_at FROM job_applications ORDER BY submitted_at DESC LIMIT 5');
    
    res.json({
      totalSubmissions: countRows[0].total,
      recentApplications: latestRows
    });
  } catch (error) {
    console.error('MySQL Stats Fetch Error:', error);
    res.status(500).json({ error: 'Database stats retrieval failed' });
  }
});

// 4. ADMIN ROUTE: Generate and download the master tracking spreadsheet (with City column)
app.get('/api/admin/download-applicants', async (req, res) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM job_applications ORDER BY submitted_at DESC');
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Job Applicants');

    // Defines clear column structures matching the schema
    worksheet.columns = [
      { header: 'APPLICANT ID', key: 'id', width: 15 },
      { header: 'CANDIDATE NAME', key: 'full_name', width: 25 },
      { header: 'EMAIL ID', key: 'email', width: 25 },
      { header: 'PHONE NUMBER', key: 'phone', width: 20 },
      { header: 'CITY', key: 'city', width: 18 },
      { header: 'FULL ADDRESS', key: 'address', width: 45 },
      { header: 'QUALIFICATION & COLLEGE', key: 'qualification_college', width: 35 },
      { header: 'APPLIED TIMESTAMP', key: 'submitted_at', width: 20 }
    ];

    rows.forEach((row: any) => worksheet.addRow(row));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=job_candidate_leads.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('MySQL Excel Export Error:', error);
    res.status(500).send('Error generating Excel file');
  }
});

app.listen(5000, () => console.log('Job Portal Backend running on port 5000'));