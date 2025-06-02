// ===============================================
// BACKEND EXPRESS.JS - SISTEM RESERVASI VILLA BESTEVILLA
// ===============================================
// File ini adalah server backend yang menangani semua API endpoint untuk:
// 1. Reservasi villa dengan sistem status (pending/accepted/rejected)
// 2. Admin panel dengan autentikasi JWT
// 3. Integrasi payment gateway Midtrans
// 4. Sistem pengecekan ketersediaan villa
// 5. Management kontak dan kritik saran

// ===============================================
// BAGIAN 1: IMPORT DEPENDENCIES
// ===============================================
const express = require('express');           // Framework web server
const bodyParser = require('body-parser');    // Middleware untuk parsing request body
const oracledb = require('oracledb');         // Driver Oracle Database
const multer = require('multer');             // Middleware untuk file upload
const path = require('path');                 // Utilities untuk file path
const fs = require('fs');                     // File system operations
const jwt = require('jsonwebtoken');          // JSON Web Token untuk autentikasi
const bcrypt = require('bcrypt');             // Password hashing
const midtransClient = require('midtrans-client'); // Midtrans payment gateway client

// ===============================================
// BAGIAN 2: KONFIGURASI APLIKASI
// ===============================================
const app = express();
const PORT = process.env.PORT || 2207; // Port server, default 2207

// ===============================================
// BAGIAN 3: KONFIGURASI DATABASE ORACLE
// ===============================================
// Konfigurasi koneksi ke Oracle Database
const dbConfig = {
    user: 'C##JALES',              // Username database Oracle
    password: 'jales123',          // Password database
    connectString: 'localhost/orcl' // Connection string (host/service_name)
};

// ===============================================
// BAGIAN 4: KONFIGURASI JWT (JSON WEB TOKEN)
// ===============================================
// Secret key untuk signing JWT tokens - PENTING: ganti dengan key yang lebih aman di production
const JWT_SECRET = 'bestevilla-super-secret-jwt-key-2024';

// ===============================================
// BAGIAN 5: KONFIGURASI MIDTRANS PAYMENT GATEWAY
// ===============================================
// Setup Midtrans client untuk payment processing
let snap = new midtransClient.Snap({
    isProduction: false, // Set ke true jika sudah production (live environment)
    serverKey: 'SB-Mid-server-JznZpwIa4JjyvETA_yWcRh-R', // Server Key dari Midtrans dashboard
    clientKey: 'SB-Mid-client-wDhW2aU40eVy31-g'          // Client Key dari Midtrans dashboard
});
// CATATAN: Ganti dengan credentials Midtrans yang sebenarnya

// ===============================================
// BAGIAN 6: MIDDLEWARE SETUP
// ===============================================
// Static file serving - untuk file CSS, JS, images di folder public
app.use(express.static('public'));
app.use(express.static('vendor'));

// Body parser middleware - untuk parsing form data dan JSON
app.use(bodyParser.urlencoded({ extended: true })); // Untuk form data
app.use(bodyParser.json());                         // Untuk JSON data

// ===============================================
// BAGIAN 7: KONFIGURASI FILE UPLOAD (MULTER)
// ===============================================
// Setup multer untuk handling file upload (bukti DP)
const storage = multer.diskStorage({
    // Tentukan folder tujuan upload
    destination: (req, file, cb) => {
        const uploadPath = 'public/uploads/';
        fs.mkdirSync(uploadPath, { recursive: true }); // Buat folder jika belum ada
        cb(null, uploadPath);
    },
    // Tentukan nama file (dengan timestamp untuk uniqueness)
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '_' + file.originalname;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage }); // Inisialisasi multer dengan konfigurasi storage

// ===============================================
// BAGIAN 8: ENDPOINT RESERVASI (PUBLIC)
// ===============================================
// Endpoint untuk menangani form reservasi dari website
app.post('/reservasi', upload.single('buktiDP'), async (req, res) => {
    try {
        // Logging untuk debugging
        console.log("Form data received:", req.body);
        console.log("File received:", req.file);

        // Ekstrak data dari request body
        const {
            nama, alamat, alamatEmail, nomorHP,
            jumlahOrang, checkIn, jamCheckIn,
            checkOut, jamCheckOut, pilihanVila
        } = req.body;

        // Handle file upload - ambil filename jika ada file yang diupload
        const buktiDP = req.file ? req.file.filename : null;

        // Logging untuk debugging
        console.log("pilihanVila:", pilihanVila);
        console.log("buktiDP:", buktiDP);

        // ===============================================
        // BAGIAN 9: DATABASE INSERT RESERVASI
        // ===============================================
        const connection = await oracledb.getConnection(dbConfig);

        // Insert data reservasi ke database
        // PENTING: Status default adalah 'pending'
        await connection.execute(
            `INSERT INTO RESERVASI
            (nama, alamat, alamatEmail, nomorHP, jumlahOrang, checkIn, jamCheckIn, checkOut, jamCheckOut, pilihanVila, buktiDP, status)
            VALUES (:nama, :alamat, :alamatEmail, :nomorHP, :jumlahOrang, TO_DATE(:checkIn, 'YYYY-MM-DD'), :jamCheckIn, TO_DATE(:checkOut, 'YYYY-MM-DD'), :jamCheckOut, :pilihanVila, :buktiDP, 'pending')`,
            {
                nama, alamat, alamatEmail, nomorHP,
                jumlahOrang: parseInt(jumlahOrang), // Convert string ke number
                checkIn, jamCheckIn,
                checkOut, jamCheckOut,
                pilihanVila,
                buktiDP
            },
            { autoCommit: true } // Commit otomatis setelah insert
        );

        await connection.close(); // Tutup koneksi database
        res.status(201).send('Reservasi berhasil ditambahkan');
        
    } catch (error) {
        console.error("Error in reservasi endpoint:", error);
        res.status(500).send('Gagal menambahkan reservasi');
    }
});

// ===============================================
// BAGIAN 10: ENDPOINT KRITIK SARAN (PUBLIC)
// ===============================================
// Endpoint untuk menangani form kritik dan saran
app.post('/kritiksaran', async (req, res) => {
    const { nama, judul, kritikSaran } = req.body;

    try {
        const conn = await oracledb.getConnection(dbConfig);

        // Insert kritik saran ke database
        await conn.execute(
            `INSERT INTO KRITIKSARAN (nama, judul, kritikSaran)
            VALUES (:nama, :judul, :kritikSaran)`,
            { nama, judul, kritikSaran },
            { autoCommit: true }
        );

        await conn.close();
        res.status(201).send('Kritik dan saran berhasil dikirim');
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal mengirim kritik dan saran');
    }
});

// ===============================================
// BAGIAN 11: ENDPOINT KONTAK (PUBLIC)
// ===============================================
// POST endpoint - untuk menangani form kontak
app.post('/kontakkami', async (req, res) => {
    const { nama, alamatEmail, subject, message } = req.body;

    try {
        const conn = await oracledb.getConnection(dbConfig);

        // Insert pesan kontak ke database dengan timestamp
        await conn.execute(
            `INSERT INTO KONTAK (nama, alamatEmail, subject, message, created_at)
            VALUES (:nama, :alamatEmail, :subject, :message, SYSDATE)`,
            { nama, alamatEmail, subject, message },
            { autoCommit: true }
        );

        await conn.close();
        res.status(201).send('Pesan berhasil dikirim');
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal mengirim pesan');
    }
});

// GET endpoint - untuk mengambil data kontak (mungkin untuk admin)
app.get('/kontakkami', async (req, res) => {
    try {
        const conn = await oracledb.getConnection(dbConfig);
        const result = await conn.execute(`SELECT * FROM KONTAK`);
        await conn.close();

        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).send('Terjadi kesalahan');
    }
});

// ===============================================
// BAGIAN 12: ENDPOINT CHECK AVAILABILITY - LOGIKA STATUS UPDATED
// ===============================================
// Endpoint untuk mengecek ketersediaan villa berdasarkan tanggal
// LOGIKA PENTING: Hanya reservasi dengan status 'accepted' yang membuat villa unavailable ;;
app.get('/check-availability', async (req, res) => {
    try {
        console.log('Check availability request received:', req.query);
        const { checkInDate, checkOutDate } = req.query;

        // ===============================================
        // VALIDASI INPUT
        // ===============================================
        if (!checkInDate || !checkOutDate) {
            console.log('Missing required dates');
            return res.status(400).json({ error: 'Tanggal check-in dan check-out diperlukan' });
        }

        // Validasi format tanggal (harus YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate)) {
            console.log('Invalid date format');
            return res.status(400).json({ error: 'Format tanggal harus YYYY-MM-DD' });
        }

        try {
            console.log('Connecting to database...');
            const connection = await oracledb.getConnection(dbConfig);
            console.log('Database connection established');

            // ===============================================
            // QUERY DATABASE - UPDATED LOGIC
            // ===============================================
            // PENTING: Hanya cek reservasi dengan status 'accepted';;
            // Query ini mencari overlapping dates dengan reservasi yang sudah accepted ; terima yang dicek
            const result = await connection.execute(
                `SELECT pilihanVila
                FROM RESERVASI
                WHERE STATUS = 'accepted' 
                AND (
                    (TO_DATE(:checkInDate, 'YYYY-MM-DD') BETWEEN checkIn AND checkOut - 1)
                    OR
                    (TO_DATE(:checkOutDate, 'YYYY-MM-DD') - 1 BETWEEN checkIn AND checkOut - 1)
                    OR
                    (checkIn BETWEEN TO_DATE(:checkInDate, 'YYYY-MM-DD') AND TO_DATE(:checkOutDate, 'YYYY-MM-DD') - 1)
                )`,
                { checkInDate, checkOutDate },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            console.log('Query executed successfully');
            console.log('Accepted overlapping reservations found:', result.rows.length);
            console.log('Query results:', result.rows);

            await connection.close();
            console.log('Database connection closed');

            // ===============================================
            // PROCESS RESULTS
            // ===============================================
            // Villa yang punya reservasi ACCEPTED = UNAVAILABLE
            let vilaJalesBooked = false;
            let vilaAkmalBooked = false;
            let vilaRizaldiBooked = false;

            // Loop melalui hasil query untuk marking villa yang unavailable
            if (result.rows && result.rows.length > 0) {
                for (const reservation of result.rows) {
                    const villa = reservation.PILIHANVILA;
                    console.log('Found accepted booking for villa:', villa);

                    // Mark villa sebagai booked berdasarkan nama villa
                    if (villa === 'Vila Jales') {
                        vilaJalesBooked = true; // 🚫 Villa jadi UNAVAILABLE
                    } else if (villa === 'Vila Akmal') {
                        vilaAkmalBooked = true;
                    } else if (villa === 'Vila Rizaldi') {
                        vilaRizaldiBooked = true;
                    }
                }
            }

            // ===============================================
            // PREPARE RESPONSE
            // ===============================================
            // Response format: true = available, false = unavailable
            // RESPONSE: true = AVAILABLE, false = UNAVAILABLE
            const response = {
                vilajales: !vilaJalesBooked,    // Negasi: jika booked = false, jika tidak booked = true
                vilaakmal: !vilaAkmalBooked,
                vilarizaldi: !vilaRizaldiBooked
            };

            console.log('Sending response:', response);

            // ===============================================
            // SET CACHE HEADERS
            // ===============================================
            // Headers untuk mencegah caching agar data selalu fresh
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');

            res.status(200).json(response);

        } catch (dbError) {
            console.error('Database error:', dbError);
            
            // Handle specific Oracle error - table tidak exists
            if (dbError.message && dbError.message.includes('ORA-00942')) {
                console.log('Table does not exist - sending fallback response');
                return res.status(200).json({
                    vilajales: true,  // Semua villa available jika table tidak ada
                    vilaakmal: true,
                    vilarizaldi: true
                });
            }
            throw dbError;
        }

    } catch (error) {
        console.error("Error checking availability:", error);
        res.status(500).json({ error: 'Gagal memeriksa ketersediaan: ' + error.message });
    }
});

// ===============================================
// BAGIAN 13: ENDPOINT GET UNAVAILABLE DATES - UPDATED LOGIC
// ===============================================
// Endpoint untuk mengambil daftar tanggal yang unavailable untuk ditampilkan di tabel
// LOGIKA: ENDPOINT INI YANG MENENTUKAN DATA TABEL "TANGGAL TIDAK TERSEDIA" ;;
app.get('/unavailable-dates', async (req, res) => {
    try {
        console.log('Request for unavailable dates received');
        const connection = await oracledb.getConnection(dbConfig);


        // INI KODE KUNCI: HANYA AMBIL STATUS 'ACCEPTED' 
        // Query ini MENGABAIKAN reservasi dengan status 'pending' atau 'rejected'
        const result = await connection.execute(
            `SELECT
                pilihanVila,
                TO_CHAR(checkIn, 'YYYY-MM-DD') AS checkInDate,
                TO_CHAR(checkOut, 'YYYY-MM-DD') AS checkOutDate
            FROM RESERVASI
            WHERE STATUS = 'accepted'
            ORDER BY checkIn`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        await connection.close();

        // Struktur data berdasarkan nama villa
        // Hanya reservasi ACCEPTED yang masuk ke tabel
        const unavailableDates = {
            'Vila Jales': [],
            'Vila Akmal': [],
            'Vila Rizaldi': []
        };

        // Loop melalui hasil query dan group berdasarkan villa
        result.rows.forEach(booking => {
            const villa = booking.PILIHANVILA;
            const checkIn = new Date(booking.CHECKINDATE);
            const checkOut = new Date(booking.CHECKOUTDATE);

            // Format tanggal ke DD/MM/YYYY untuk display
            const formattedCheckIn = formatDate(checkIn);
            const formattedCheckOut = formatDate(checkOut);

            // Tambahkan ke array villa yang sesuai
            if (unavailableDates[villa]) {
                unavailableDates[villa].push({
                    checkIn: formattedCheckIn,
                    checkOut: formattedCheckOut
                });
            }
        });

        console.log('Unavailable dates (accepted only):', unavailableDates);

        // Set anti-cache headers
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.status(200).json(unavailableDates);

    } catch (error) {
        console.error('Error fetching unavailable dates:', error);
        res.status(500).json({ error: 'Gagal mengambil data tanggal tidak tersedia' });
    }
});

// ===============================================
// BAGIAN 14: HELPER FUNCTION - FORMAT TANGGAL
// ===============================================
// Fungsi helper untuk memformat tanggal ke format DD/MM/YYYY
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 karena month dimulai dari 0
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// ===============================================
// BAGIAN 15: MIDTRANS PAYMENT ENDPOINTS
// ===============================================

// Route untuk menampilkan halaman pembayaran
app.get('/pembayaran', (req, res) => {
    // Serve file payment.html dari folder public
    res.sendFile(path.join(__dirname, 'public', 'payment.html')); 
});

// ===============================================
// BAGIAN 16: API ENDPOINT UNTUK MEMBUAT TRANSAKSI MIDTRANS
// ===============================================
app.post('/api/payment', async (req, res) => {
    const { order_id, gross_amount, customer_name, customer_email, customer_phone } = req.body;

    // ===============================================
    // VALIDASI INPUT PAYMENT
    // ===============================================
    if (!order_id || !gross_amount || !customer_name || !customer_email || !customer_phone) {
        return res.status(400).json({ message: 'Semua field wajib diisi' });
    }

    // Validasi gross_amount adalah angka valid
    const amount = parseInt(gross_amount);
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Jumlah pembayaran tidak valid' });
    }

    // ===============================================
    // SETUP PARAMETER MIDTRANS
    // ===============================================
    const parameter = {
        transaction_details: {
            order_id: order_id,        // ID transaksi unik
            gross_amount: amount       // Total amount
        },
        customer_details: {
            first_name: customer_name,
            email: customer_email,
            phone: customer_phone
        }
        // Opsional: Item details untuk detail pembayaran
        // item_details: [
        //     {
        //         id: 'VILLA-BESTEVILLA-001',
        //         price: amount,
        //         quantity: 1,
        //         name: 'Reservasi Vila BesteVilla'
        //     }
        // ]
    };

    try {
        console.log('Creating Midtrans transaction with parameters:', parameter);
        
        // ===============================================
        // CREATE MIDTRANS TRANSACTION
        // ===============================================
        const transaction = await snap.createTransaction(parameter);
        console.log('Midtrans transaction created:', transaction);
        
        // Return token dan redirect URL ke frontend
        res.json({
            token: transaction.token,
            redirect_url: transaction.redirect_url
        });
        
    } catch (error) {
        console.error("Error creating Midtrans transaction:", error.message);
        res.status(500).json({ message: 'Gagal membuat transaksi Midtrans', error: error.message });
    }
});

// ===============================================
// BAGIAN 17: MIDTRANS NOTIFICATION HANDLER
// ===============================================
// Endpoint untuk menerima notifikasi dari Midtrans tentang status pembayaran
app.post('/api/midtrans-notification', async (req, res) => {
    try {
        const notification = req.body;
        console.log('Midtrans Notification Received:', notification);

        // Verifikasi notifikasi dari Midtrans
        const statusResponse = await snap.transaction.notification(notification);

        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        console.log(`Transaction ID: ${orderId}, Status: ${transactionStatus}, Fraud: ${fraudStatus}`);

        // ===============================================
        // LOGIC UPDATE STATUS BERDASARKAN MIDTRANS RESPONSE
        // ===============================================
        // Di sini Anda bisa mengupdate status reservasi di database
        // Contoh logika (commented out):
        /*
        let connection;
        try {
            connection = await oracledb.getConnection(dbConfig);
            let newStatus = '';
            
            // Tentukan status baru berdasarkan transaction status
            if (transactionStatus == 'capture') {
                if (fraudStatus == 'accept') {
                    newStatus = 'paid';
                }
            } else if (transactionStatus == 'settlement') {
                newStatus = 'paid';
            } else if (transactionStatus == 'cancel' || transactionStatus == 'expire' || transactionStatus == 'deny') {
                newStatus = 'cancelled';
            } else if (transactionStatus == 'pending') {
                newStatus = 'pending_payment';
            }

            if (newStatus) {
                await connection.execute(
                    `UPDATE RESERVASI SET STATUS = :newStatus, UPDATED_AT = SYSDATE WHERE ORDER_ID = :orderId`,
                    { newStatus, orderId },
                    { autoCommit: true }
                );
                console.log(`Order ${orderId} updated to status: ${newStatus}`);
            }
        } catch (dbError) {
            console.error('Error updating DB from Midtrans notification:', dbError);
        } finally {
            if (connection) {
                await connection.close();
            }
        }
        */

        res.status(200).send('OK'); // Response wajib untuk Midtrans
        
    } catch (error) {
        console.error('Error processing Midtrans notification:', error.message);
        res.status(500).send('Error');
    }
});

// ===============================================
// BAGIAN 18: ADMIN AUTHENTICATION MIDDLEWARE
// ===============================================
// Middleware untuk memverifikasi JWT token admin
function verifyAdminToken(req, res, next) {
    // Ambil token dari header Authorization
    const token = req.headers.authorization?.split(' ')[1]; // Format: "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: 'Token tidak ditemukan' });
    }

    try {
        // Verify dan decode JWT token
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded; // Simpan data admin ke request object
        next(); // Lanjut ke handler berikutnya
    } catch (error) {
        return res.status(401).json({ error: 'Token tidak valid' });
    }
}

// ===============================================
// BAGIAN 19: DEBUG ENDPOINTS
// ===============================================

// Debug endpoint untuk test koneksi database
app.get('/debug/db-test', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute('SELECT SYSDATE FROM dual'); // Query test sederhana

        res.json({
            success: true,
            message: 'Database connection OK',
            timestamp: result.rows[0][0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// ===============================================
// BAGIAN 20: SETUP ADMIN ENDPOINT (DEBUG)
// ===============================================
// Endpoint untuk setup admin user pertama kali
app.get('/debug/setup-admin', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // ===============================================
        // 1. DROP EXISTING TABLES (CLEAN SETUP)
        // ===============================================
        try {
            await connection.execute(`DROP TABLE admin_users CASCADE CONSTRAINTS`);
            console.log('🗑️ Dropped existing admin_users table');
        } catch (dropError) {
            console.log('ℹ️ admin_users table might not exist:', dropError.message);
        }

        try {
            await connection.execute(`DROP TABLE admin_login_logs CASCADE CONSTRAINTS`);
            console.log('🗑️ Dropped existing admin_login_logs table');
        } catch (dropError) {
            console.log('ℹ️ admin_login_logs table might not exist:', dropError.message);
        }

        // ===============================================
        // 2. CREATE ADMIN_USERS TABLE
        // ===============================================
        await connection.execute(`
            CREATE TABLE admin_users (
                id NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                username VARCHAR2(50) UNIQUE NOT NULL,
                password_hash VARCHAR2(255) NOT NULL,
                is_active NUMBER(1) DEFAULT 1,
                created_at DATE DEFAULT SYSDATE
            )
        `);
        console.log('✅ Table admin_users created');

        // ===============================================
        // 3. CREATE ADMIN_LOGIN_LOGS TABLE
        // ===============================================
        await connection.execute(`
            CREATE TABLE admin_login_logs (
                id NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                admin_id NUMBER,
                login_time DATE DEFAULT SYSDATE,
                ip_address VARCHAR2(45),
                status VARCHAR2(20) DEFAULT 'success'
            )
        `);
        console.log('✅ Table admin_login_logs created');

        // ===============================================
        // 4. ADD STATUS COLUMNS TO RESERVASI TABLE
        // ===============================================
        try {
            await connection.execute(`
                ALTER TABLE RESERVASI ADD (
                    status VARCHAR2(20) DEFAULT 'pending',
                    updated_at DATE,
                    updated_by NUMBER
                )
            `);
            console.log('✅ Added admin columns to reservasi table');
        } catch (alterError) {
            console.log('ℹ️ Reservasi table might already have admin columns:', alterError.message);
        }

        // ===============================================
        // 5. CREATE DEFAULT ADMIN USER
        // ===============================================
        // Hash password menggunakan bcrypt
        const passwordHash = await bcrypt.hash('admin123', 10); // Salt rounds = 10

        const result = await connection.execute(
            `INSERT INTO admin_users (username, password_hash, is_active)
             VALUES (:username, :password_hash, 1)`,
            {
                username: 'admin',
                password_hash: passwordHash
            }
        );

        await connection.commit(); // Commit semua perubahan

        // ===============================================
        // 6. VERIFY ADMIN USER CREATED
        // ===============================================
        const verifyResult = await connection.execute(
            `SELECT id, username, is_active, created_at FROM admin_users WHERE username = 'admin'`
        );

        // ===============================================
        // 7. GENERATE HTML RESPONSE
        // ===============================================
        const htmlResponse = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Setup - BesteVilla</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .success { color: #28a745; font-size: 18px; font-weight: bold; margin-bottom: 20px; }
                .info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 10px 0; }
                .credentials { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107; }
                .button { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
                .button:hover { background: #0056b3; color: white; }
                .button.success { background: #28a745; }
                .button.success:hover { background: #1e7e34; }
                pre { background: #f8f9fa; padding: 10px; border-radius: 5px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎉 Admin Setup Berhasil!</h1>

                <div class="success">✅ Setup admin berhasil dikonfigurasi</div>

                <div class="info">
                    <h3>Admin User Created:</h3>
                    <pre>
ID: ${verifyResult.rows[0][0]}
Username: ${verifyResult.rows[0][1]}
Active: ${verifyResult.rows[0][2] ? 'Yes' : 'No'}
Created: ${verifyResult.rows[0][3]}
                    </pre>
                </div>

                <div class="credentials">
                    <h3>🔐 Login Credentials:</h3>
                    <p><strong>Username:</strong> admin</p>
                    <p><strong>Password:</strong> admin123</p>
                    <p><em>⚠️ Pastikan untuk mengganti password setelah login pertama!</em></p>
                </div>

                <div class="info">
                    <h3>🧪 Test & Access:</h3>
                    <a href="/debug/db-test" class="button">Test Database</a>
                    <a href="/debug/check-admin" class="button">Check Admin Users</a>
                    <a href="/admin/login.html" class="button success">🚀 Go to Admin Login</a>
                </div>

                <div class="info">
                    <h3>✅ What was created:</h3>
                    <ul>
                        <li>✅ Table: admin_users (dengan simplified structure)</li>
                        <li>✅ Table: admin_login_logs</li>
                        <li>✅ Added status column to reservasi table</li>
                        <li>✅ Created admin user with bcrypt hashed password</li>
                        <li>✅ JWT authentication ready</li>
                    </ul>
                </div>

                <div class="info">
                    <h3>🔄 Status Logic:</h3>
                    <ul>
                        <li><strong>Pending:</strong> Tidak muncul di ketersediaan</li>
                        <li><strong>Accepted:</strong> Muncul di ketersediaan (villa jadi unavailable)</li>
                        <li><strong>Rejected:</strong> Tidak muncul di ketersediaan</li>
                    </ul>
                </div>
            </div>
        </body>
        </html>
        `;

        res.send(htmlResponse);

    } catch (error) {
        console.error('Setup admin error:', error);

        // Error response dengan troubleshooting info
        const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Setup Error</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .error { color: red; background: #ffe6e6; padding: 15px; border-radius: 5px; margin: 10px 0; }
                .container { max-width: 800px; margin: 0 auto; }
                pre { background: #f8f9fa; padding: 10px; border-radius: 5px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>❌ Setup Error</h1>
                <div class="error">
                    <p><strong>Error:</strong> ${error.message}</p>
                    <details>
                        <summary>Click to see full error details</summary>
                        <pre>${error.stack}</pre>
                    </details>
                </div>

                <h3>🔧 Troubleshooting:</h3>
                <ol>
                    <li><a href="/debug/db-test">Test Database Connection</a></li>
                    <li>Check if Oracle DB is running</li>
                    <li>Verify database credentials in app.js</li>
                    <li>Try refreshing this page to retry setup</li>
                </ol>
            </div>
        </body>
        </html>
        `;

        res.status(500).send(errorHtml);
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

// ===============================================
// BAGIAN 21: ADMIN LOGIN ENDPOINT
// ===============================================
app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;

    console.log('🔐 Admin login attempt:', { username, password: '***' });

    // Validasi input
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Username dan password harus diisi'
        });
    }

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        console.log('✅ Database connection established');

        // ===============================================
        // QUERY ADMIN USER
        // ===============================================
        const result = await connection.execute(
            `SELECT id, username, password_hash, is_active, created_at
             FROM admin_users
             WHERE UPPER(username) = UPPER(:username) AND is_active = 1`,
            { username: username },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        console.log('📊 Query result:', result.rows.length, 'admin found');

        if (result.rows.length === 0) {
            console.log('❌ No admin user found');
            return res.status(401).json({
                success: false,
                message: 'Username tidak ditemukan'
            });
        }

        const admin = result.rows[0];
        console.log('👤 Admin found:', { id: admin.ID, username: admin.USERNAME });

        // ===============================================
        // VERIFY PASSWORD DENGAN BCRYPT
        // ===============================================
        let isValidPassword = false;
        try {
            isValidPassword = await bcrypt.compare(password, admin.PASSWORD_HASH);
            console.log('🔑 Password verification:', isValidPassword ? 'SUCCESS' : 'FAILED');
        } catch (bcryptError) {
            console.error('❌ Bcrypt error:', bcryptError.message);
            return res.status(500).json({
                success: false,
                message: 'Error validasi password'
            });
        }

        if (!isValidPassword) {
            console.log('❌ Invalid password');
            return res.status(401).json({
                success: false,
                message: 'Password salah'
            });
        }

        // ===============================================
        // GENERATE JWT TOKEN
        // ===============================================
        const token = jwt.sign(
            {
                id: admin.ID,
                username: admin.USERNAME
            },
            JWT_SECRET,
            { expiresIn: '24h' } // Token berlaku 24 jam
        );

        // ===============================================
        // LOG LOGIN ACTIVITY
        // ===============================================
        try {
            await connection.execute(
                `INSERT INTO admin_login_logs (admin_id, login_time, ip_address, status)
                 VALUES (:admin_id, SYSDATE, :ip_address, 'success')`,
                {
                    admin_id: admin.ID,
                    ip_address: req.ip || 'unknown'
                }
            );
            await connection.commit();
        } catch (logError) {
            console.log('⚠️ Login log error:', logError.message);
        }

        console.log('✅ Login successful for:', admin.USERNAME);

        // Response sukses dengan token
        res.json({
            success: true,
            token: token,
            admin: {
                id: admin.ID,
                username: admin.USERNAME
            }
        });

    } catch (error) {
        console.error('💥 Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server: ' + error.message
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// ===============================================
// BAGIAN 22: VERIFY ADMIN TOKEN ENDPOINT
// ===============================================
app.get('/admin/verify', verifyAdminToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Verify admin masih aktif di database
        const result = await connection.execute(
            `SELECT id, username, created_at
             FROM admin_users
             WHERE id = :id AND is_active = 1`,
            { id: req.admin.id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Admin tidak ditemukan' });
        }

        const admin = result.rows[0];
        res.json({
            admin: {
                id: admin.ID,
                username: admin.USERNAME,
                createdAt: admin.CREATED_AT
            }
        });

    } catch (error) {
        console.error('Admin verify error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// ===============================================
// BAGIAN 23: DASHBOARD STATISTICS ENDPOINT
// ===============================================
app.get('/admin/stats', verifyAdminToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Query berbagai statistik untuk dashboard
        
        // Total reservasi
        const reservasiResult = await connection.execute(
            `SELECT COUNT(*) as total FROM RESERVASI`
        );

        // Reservasi pending
        const pendingResult = await connection.execute(
            `SELECT COUNT(*) as pending FROM RESERVASI WHERE STATUS = 'pending' OR STATUS IS NULL`
        );

        // Total kritik saran
        const kritikResult = await connection.execute(
            `SELECT COUNT(*) as total FROM KRITIKSARAN`
        );

        // Total kontak
        const kontakResult = await connection.execute(
            `SELECT COUNT(*) as total FROM KONTAK`
        );

        // Response dengan statistik
        res.json({
            totalReservasi: reservasiResult.rows[0][0] || 0,
            pendingReservasi: pendingResult.rows[0][0] || 0,
            totalKritik: kritikResult.rows[0][0] || 0,
            totalKontak: kontakResult.rows[0][0] || 0
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server: ' + error.message });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// ===============================================
// BAGIAN 24: ADMIN RESERVASI MANAGEMENT
// ===============================================

// GET - Ambil semua data reservasi
app.get('/admin/reservasi', verifyAdminToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Query semua reservasi dengan informasi lengkap
        const result = await connection.execute(
            `SELECT NAMA, ALAMAT, ALAMATEMAIL, NOMORHP, JUMLAHORANG,
                    CHECKIN, JAMCHECKIN, CHECKOUT, JAMCHECKOUT,
                    PILIHANVILA, BUKTIDP,
                    NVL(STATUS, 'pending') as CURRENT_STATUS,
                    UPDATED_AT, UPDATED_BY,
                    ROWNUM as ID
             FROM RESERVASI
             ORDER BY CHECKIN DESC`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        console.log('📊 Reservasi query result:', result.rows.length, 'rows found');

        // Format data untuk frontend
        const reservasi = result.rows.map(row => ({
            id: row.ID,
            nama: row.NAMA,
            alamat: row.ALAMAT,
            alamatEmail: row.ALAMATEMAIL,
            nomorHP: row.NOMORHP,
            jumlahOrang: row.JUMLAHORANG,
            checkIn: row.CHECKIN,
            jamCheckIn: row.JAMCHECKIN,
            checkOut: row.CHECKOUT,
            jamCheckOut: row.JAMCHECKOUT,
            pilihanVila: row.PILIHANVILA,
            buktiDP: row.BUKTIDP,
            status: row.CURRENT_STATUS,
            tanggal: row.CHECKIN,
            updatedAt: row.UPDATED_AT,
            updatedBy: row.UPDATED_BY
        }));

        console.log('📤 Sending reservasi data:', reservasi.length, 'records');
        res.json(reservasi);

    } catch (error) {
        console.error('Get reservasi error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server: ' + error.message });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// PUT - Update status reservasi
app.put('/admin/reservasi/:id/status', verifyAdminToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    console.log('🔄 Update reservasi status:', { id, status });

    // Validasi status yang diperbolehkan
    if (!['pending', 'accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status tidak valid' });
    }

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // ===============================================
        // FIND SPECIFIC RECORD BERDASARKAN POSISI
        // ===============================================
        const selectResult = await connection.execute(
            `SELECT NAMA, ALAMATEMAIL, CHECKIN, CHECKOUT, PILIHANVILA
             FROM (
                 SELECT NAMA, ALAMATEMAIL, CHECKIN, CHECKOUT, PILIHANVILA, ROWNUM as rn
                 FROM RESERVASI
                 ORDER BY CHECKIN DESC
             )
             WHERE rn = :id`,
            { id: parseInt(id) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (selectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Reservasi tidak ditemukan' });
        }

        const reservasiData = selectResult.rows[0];

        // ===============================================
        // UPDATE STATUS BERDASARKAN UNIQUE COMBINATION
        // ===============================================
        const result = await connection.execute(
            `UPDATE RESERVASI
             SET STATUS = :status,
                 UPDATED_AT = SYSDATE,
                 UPDATED_BY = :admin_id
             WHERE NAMA = :nama
               AND ALAMATEMAIL = :alamatEmail
               AND CHECKIN = :checkIn
               AND CHECKOUT = :checkOut
               AND PILIHANVILA = :pilihanVila`,
            {
                status: status,
                admin_id: req.admin.id,
                nama: reservasiData.NAMA,
                alamatEmail: reservasiData.ALAMATEMAIL,
                checkIn: reservasiData.CHECKIN,
                checkOut: reservasiData.CHECKOUT,
                pilihanVila: reservasiData.PILIHANVILA
            }
        );

        console.log('📝 Update result:', result.rowsAffected, 'rows affected');

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Tidak ada data yang diupdate' });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Status reservasi berhasil diupdate',
            rowsAffected: result.rowsAffected
        });

    } catch (error) {
        console.error('Update reservasi status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server: ' + error.message });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// DELETE - Hapus reservasi
app.delete('/admin/reservasi/:id', verifyAdminToken, async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Find specific record berdasarkan posisi
        const selectResult = await connection.execute(
            `SELECT NAMA, ALAMATEMAIL, CHECKIN, CHECKOUT, PILIHANVILA
             FROM (
                 SELECT NAMA, ALAMATEMAIL, CHECKIN, CHECKOUT, PILIHANVILA, ROWNUM as rn
                 FROM RESERVASI
                 ORDER BY CHECKIN DESC
             )
             WHERE rn = :id`,
            { id: parseInt(id) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (selectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Reservasi tidak ditemukan' });
        }

        const reservasiData = selectResult.rows[0];

        // Delete berdasarkan kombinasi unique fields
        const result = await connection.execute(
            `DELETE FROM RESERVASI
             WHERE NAMA = :nama
               AND ALAMATEMAIL = :alamatEmail
               AND CHECKIN = :checkIn
               AND CHECKOUT = :checkOut
               AND PILIHANVILA = :pilihanVila`,
            {
                nama: reservasiData.NAMA,
                alamatEmail: reservasiData.ALAMATEMAIL,
                checkIn: reservasiData.CHECKIN,
                checkOut: reservasiData.CHECKOUT,
                pilihanVila: reservasiData.PILIHANVILA
            }
        );

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Tidak ada data yang dihapus' });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Reservasi berhasil dihapus'
        });

    } catch (error) {
        console.error('Delete reservasi error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// ===============================================
// BAGIAN 25: ADMIN KRITIK SARAN MANAGEMENT
// ===============================================

// GET - Ambil semua kritik saran
app.get('/admin/kritik-saran', verifyAdminToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Query kritik saran dengan handling CLOB untuk Oracle
        const result = await connection.execute(
            `SELECT ID, NAMA, JUDUL, KRITIKSARAN
             FROM KRITIKSARAN
             ORDER BY ID DESC`,
            {},
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
                fetchInfo: {
                    KRITIKSARAN: { type: oracledb.STRING } // Convert CLOB to STRING
                }
            }
        );

        console.log('📊 Kritik saran query result:', result.rows.length, 'rows found');

        // Format data untuk frontend
        const kritikSaran = result.rows.map(row => ({
            id: row.ID,
            nama: row.NAMA,
            judul: row.JUDUL,
            kritikSaran: row.KRITIKSARAN || 'No content',
            tanggal: new Date() // Default date karena tidak ada created_at
        }));

        console.log('📤 Sending kritik saran data:', kritikSaran.length, 'records');
        res.json(kritikSaran);

    } catch (error) {
        console.error('Get kritik saran error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server: ' + error.message });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// DELETE - Hapus kritik saran
app.delete('/admin/kritik-saran/:id', verifyAdminToken, async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        const result = await connection.execute(
            `DELETE FROM KRITIKSARAN WHERE ID = :id`,
            { id: parseInt(id) }
        );

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Kritik saran tidak ditemukan' });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Kritik saran berhasil dihapus'
        });

    } catch (error) {
        console.error('Delete kritik saran error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// ===============================================
// BAGIAN 26: ADMIN KONTAK MANAGEMENT
// ===============================================

// GET - Ambil semua data kontak
app.get('/admin/kontak', verifyAdminToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Query kontak dengan handling CLOB untuk Oracle
        const result = await connection.execute(
            `SELECT ID, NAMA, ALAMATEMAIL, SUBJECT, MESSAGE,
                    NVL(CREATED_AT, SYSDATE) as CREATED_AT
             FROM KONTAK
             ORDER BY NVL(CREATED_AT, SYSDATE) DESC`,
            {},
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
                fetchInfo: {
                    MESSAGE: { type: oracledb.STRING } // Convert CLOB to STRING
                }
            }
        );

        console.log('📊 Kontak query result:', result.rows.length, 'rows found');

        // Format data untuk frontend
        const kontak = result.rows.map(row => ({
            id: row.ID,
            nama: row.NAMA,
            alamatEmail: row.ALAMATEMAIL,
            subject: row.SUBJECT,
            message: row.MESSAGE || 'No content',
            tanggal: row.CREATED_AT
        }));

        console.log('📤 Sending kontak data:', kontak.length, 'records');
        res.json(kontak);

    } catch (error) {
        console.error('Get kontak error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server: ' + error.message });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// DELETE - Hapus kontak
app.delete('/admin/kontak/:id', verifyAdminToken, async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        const result = await connection.execute(
            `DELETE FROM KONTAK WHERE ID = :id`,
            { id: parseInt(id) }
        );

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Kontak tidak ditemukan' });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Kontak berhasil dihapus'
        });

    } catch (error) {
        console.error('Delete kontak error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// ===============================================
// BAGIAN 27: SERVER STARTUP & INFORMATION
// ===============================================
app.listen(PORT, () => {
    // Comprehensive startup logging dengan informasi lengkap
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`📊 Database: ${dbConfig.user}@${dbConfig.connectString}`);
    console.log(`🔗 Midtrans Production Mode: ${snap.apiConfig.isProduction}`);
    
    // console.log(`🔧 Debug endpoints:`);
    // console.log(`   - GET  /debug/db-test`);
    // console.log(`   - GET  /debug/setup-admin`);
    
    // console.log(`🔐 Admin endpoints:`);
    // console.log(`   - POST /admin/login`);
    // console.log(`   - GET  /admin/verify`);
    // console.log(`   - GET  /admin/stats`);
    // console.log(`   - GET  /admin/reservasi`);
    // console.log(`   - GET  /admin/kritik-saran`);
    // console.log(`   - GET  /admin/kontak`);
    
    // console.log(`💳 Midtrans Payment endpoints:`);
    // console.log(`   - GET  /pembayaran (menampilkan form pembayaran, pastikan public/payment.html ada)`);
    // console.log(`   - POST /api/payment (membuat transaksi Midtrans)`);
    // console.log(`   - POST /api/midtrans-notification (handler notifikasi Midtrans)`);
    
    // console.log(`📝 Form endpoints:`);
    // console.log(`   - POST /reservasi`);
    // console.log(`   - POST /kritiksaran`);
    // console.log(`   - POST /kontakkami`);
    // console.log(`   - GET  /check-availability (UPDATED: only accepted)`);
    // console.log(`   - GET  /unavailable-dates (UPDATED: only accepted)`);
    
    // console.log(`🎯 Status Logic:`);
    // console.log(`   - Pending: Tidak tampil di ketersediaan`);
    // console.log(`   - Accepted: Tampil di ketersediaan (villa unavailable)`);
    // console.log(`   - Rejected: Tidak tampil di ketersediaan`);
});

// ===============================================
// RINGKASAN ARSITEKTUR SISTEM:
// ===============================================
// 1. **PUBLIC API** - Form reservasi, kontak, kritik saran
// 2. **AVAILABILITY SYSTEM** - Cek ketersediaan dengan status logic
// 3. **ADMIN PANEL** - CRUD operations dengan JWT authentication
// 4. **PAYMENT GATEWAY** - Integrasi Midtrans untuk pembayaran
// 5. **DATABASE** - Oracle DB dengan proper connection handling
// 6. **SECURITY** - bcrypt password hashing, JWT tokens
// 7. **FILE UPLOAD** - Multer untuk handling bukti DP
// 8. **ERROR HANDLING** - Comprehensive error handling di semua endpoint
// 9. **LOGGING** - Detailed console logging untuk debugging
// 10. **ANTI-CACHE** - Headers untuk memastikan data fresh
// ===============================================