const express = require('express');
const bodyParser = require('body-parser');
const oracledb = require('oracledb');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const midtransClient = require('midtrans-client'); // Import Midtrans Client

const app = express();
const PORT = process.env.PORT || 2207;

// Konfigurasi Oracle
const dbConfig = {
    user: 'C##JALES',
    password: 'jales123',
    connectString: 'localhost/orcl'
};

// JWT Secret
const JWT_SECRET = 'bestevilla-super-secret-jwt-key-2024';

// --- Konfigurasi Midtrans ---
// Pastikan ini ada di bagian atas bersama konfigurasi lain
let snap = new midtransClient.Snap({
    isProduction: false, // Set ke true jika sudah production
    serverKey: 'SB-Mid-server-TY4yQMLqtfHkDspOXihruzW-', // Ganti dengan Server Key Midtrans Anda
    clientKey: 'SB-Mid-client-4s6U-2lGi11T3znh' // Ganti dengan Client Key Midtrans Anda
});
// --- End Konfigurasi Midtrans ---

// Middleware
app.use(express.static('public'));
app.use(express.static('vendor'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ==============================
// KONFIGURASI UPLOAD FILE
// ==============================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'public/uploads/';
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '_' + file.originalname;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// ==============================
// ORIGINAL ENDPOINTS (FORM WEBSITE)
// ==============================

// Endpoint RESERVASI
app.post('/reservasi', upload.single('buktiDP'), async (req, res) => {
    try {
        console.log("Form data received:", req.body);
        console.log("File received:", req.file);

        const {
            nama, alamat, alamatEmail, nomorHP,
            jumlahOrang, checkIn, jamCheckIn,
            checkOut, jamCheckOut, pilihanVila
        } = req.body;

        const buktiDP = req.file ? req.file.filename : null;

        console.log("pilihanVila:", pilihanVila);
        console.log("buktiDP:", buktiDP);

        const connection = await oracledb.getConnection(dbConfig);

        // Tambahkan 'status' ke INSERT statement, defaultnya 'pending'
        await connection.execute(
            `INSERT INTO RESERVASI
            (nama, alamat, alamatEmail, nomorHP, jumlahOrang, checkIn, jamCheckIn, checkOut, jamCheckOut, pilihanVila, buktiDP, status)
            VALUES (:nama, :alamat, :alamatEmail, :nomorHP, :jumlahOrang, TO_DATE(:checkIn, 'YYYY-MM-DD'), :jamCheckIn, TO_DATE(:checkOut, 'YYYY-MM-DD'), :jamCheckOut, :pilihanVila, :buktiDP, 'pending')`,
            {
                nama, alamat, alamatEmail, nomorHP,
                jumlahOrang: parseInt(jumlahOrang),
                checkIn, jamCheckIn,
                checkOut, jamCheckOut,
                pilihanVila,
                buktiDP
            },
            { autoCommit: true }
        );

        await connection.close();
        res.status(201).send('Reservasi berhasil ditambahkan');
    } catch (error) {
        console.error("Error in reservasi endpoint:", error);
        res.status(500).send('Gagal menambahkan reservasi');
    }
});

// KRITIK SARAN ENDPOINT
app.post('/kritiksaran', async (req, res) => {
    const { nama, judul, kritikSaran } = req.body;

    try {
        const conn = await oracledb.getConnection(dbConfig);

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

// Endpoint KONTAK
app.post('/kontakkami', async (req, res) => {
    const { nama, alamatEmail, subject, message } = req.body;

    try {
        const conn = await oracledb.getConnection(dbConfig);

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

// ==============================
// ENDPOINT CHECK AVAILABILITY - UPDATED dengan Status Logic
// ==============================
app.get('/check-availability', async (req, res) => {
    try {
        console.log('Check availability request received:', req.query);
        const { checkInDate, checkOutDate } = req.query;

        if (!checkInDate || !checkOutDate) {
            console.log('Missing required dates');
            return res.status(400).json({ error: 'Tanggal check-in dan check-out diperlukan' });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate)) {
            console.log('Invalid date format');
            return res.status(400).json({ error: 'Format tanggal harus YYYY-MM-DD' });
        }

        try {
            console.log('Connecting to database...');
            const connection = await oracledb.getConnection(dbConfig);
            console.log('Database connection established');

            // ===== UPDATED QUERY: Hanya cek reservasi dengan status 'accepted' =====
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

            let vilaJalesBooked = false;
            let vilaAkmalBooked = false;
            let vilaRizaldiBooked = false;

            if (result.rows && result.rows.length > 0) {
                for (const reservation of result.rows) {
                    const villa = reservation.PILIHANVILA;
                    console.log('Found accepted booking for villa:', villa);

                    if (villa === 'Vila Jales') {
                        vilaJalesBooked = true;
                    } else if (villa === 'Vila Akmal') {
                        vilaAkmalBooked = true;
                    } else if (villa === 'Vila Rizaldi') {
                        vilaRizaldiBooked = true;
                    }
                }
            }

            const response = {
                vilajales: !vilaJalesBooked,
                vilaakmal: !vilaAkmalBooked,
                vilarizaldi: !vilaRizaldiBooked
            };

            console.log('Sending response:', response);

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');

            res.status(200).json(response);

        } catch (dbError) {
            console.error('Database error:', dbError);
            if (dbError.message && dbError.message.includes('ORA-00942')) {
                console.log('Table does not exist - sending fallback response');
                return res.status(200).json({
                    vilajales: true,
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

// ==============================
// ENDPOINT GET UNAVAILABLE DATES - UPDATED dengan Status Logic
// ==============================
app.get('/unavailable-dates', async (req, res) => {
    try {
        console.log('Request for unavailable dates received');
        const connection = await oracledb.getConnection(dbConfig);

        // ===== UPDATED QUERY: Hanya ambil reservasi dengan status 'accepted' =====
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

        const unavailableDates = {
            'Vila Jales': [],
            'Vila Akmal': [],
            'Vila Rizaldi': []
        };

        result.rows.forEach(booking => {
            const villa = booking.PILIHANVILA;
            const checkIn = new Date(booking.CHECKINDATE);
            const checkOut = new Date(booking.CHECKOUTDATE);

            const formattedCheckIn = formatDate(checkIn);
            const formattedCheckOut = formatDate(checkOut);

            if (unavailableDates[villa]) {
                unavailableDates[villa].push({
                    checkIn: formattedCheckIn,
                    checkOut: formattedCheckOut
                });
            }
        });

        console.log('Unavailable dates (accepted only):', unavailableDates);

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.status(200).json(unavailableDates);

    } catch (error) {
        console.error('Error fetching unavailable dates:', error);
        res.status(500).json({ error: 'Gagal mengambil data tanggal tidak tersedia' });
    }
});

// Helper function untuk format tanggal
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// ==============================
// MIDTRANS PAYMENT ENDPOINTS
// ==============================

// Route tampilkan form pembayaran (jika Anda memiliki file payment.html)
app.get('/pembayaran', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'payment.html')); // Pastikan payment.html ada di folder public
});

// Endpoint API pembayaran Midtrans
app.post('/api/payment', async (req, res) => {
    const { order_id, gross_amount, customer_name, customer_email, customer_phone } = req.body;

    // Validasi input
    if (!order_id || !gross_amount || !customer_name || !customer_email || !customer_phone) {
        return res.status(400).json({ message: 'Semua field wajib diisi' });
    }

    // Pastikan gross_amount adalah angka
    const amount = parseInt(gross_amount);
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Jumlah pembayaran tidak valid' });
    }

    const parameter = {
        transaction_details: {
            order_id: order_id,
            gross_amount: amount
        },
        customer_details: {
            first_name: customer_name,
            email: customer_email,
            phone: customer_phone
        },
        // Opsional: Item details jika Anda ingin menampilkan detail produk di Midtrans
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
        const transaction = await snap.createTransaction(parameter);
        console.log('Midtrans transaction created:', transaction);
        res.json({
            token: transaction.token,
            redirect_url: transaction.redirect_url
        });
    } catch (error) {
        console.error("Error creating Midtrans transaction:", error.message);
        res.status(500).json({ message: 'Gagal membuat transaksi Midtrans', error: error.message });
    }
});

// Optional: Midtrans notification handler (untuk update status pembayaran secara real-time)
app.post('/api/midtrans-notification', async (req, res) => {
    try {
        const notification = req.body;
        console.log('Midtrans Notification Received:', notification);

        const statusResponse = await snap.transaction.notification(notification);

        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        console.log(`Transaction ID: ${orderId}, Status: ${transactionStatus}, Fraud: ${fraudStatus}`);

        // Anda bisa mengupdate status reservasi di database Anda di sini
        // Misalnya, jika transactionStatus === 'capture' dan fraudStatus === 'accept'
        // Anda bisa mengubah status reservasi terkait menjadi 'paid' atau 'completed'

        // Contoh: Logika update status di database (Anda harus menyesuaikannya dengan tabel dan logika Anda)
        // let connection;
        // try {
        //     connection = await oracledb.getConnection(dbConfig);
        //     let newStatus = '';
        //     if (transactionStatus == 'capture') {
        //         if (fraudStatus == 'accept') {
        //             newStatus = 'paid';
        //         }
        //     } else if (transactionStatus == 'settlement') {
        //         newStatus = 'paid';
        //     } else if (transactionStatus == 'cancel' || transactionStatus == 'expire' || transactionStatus == 'deny') {
        //         newStatus = 'cancelled';
        //     } else if (transactionStatus == 'pending') {
        //         newStatus = 'pending_payment';
        //     }

        //     if (newStatus) {
        //         await connection.execute(
        //             `UPDATE RESERVASI SET STATUS = :newStatus, UPDATED_AT = SYSDATE WHERE ORDER_ID = :orderId`,
        //             { newStatus, orderId },
        //             { autoCommit: true }
        //         );
        //         console.log(`Order ${orderId} updated to status: ${newStatus}`);
        //     }
        // } catch (dbError) {
        //     console.error('Error updating DB from Midtrans notification:', dbError);
        // } finally {
        //     if (connection) {
        //         await connection.close();
        //     }
        // }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error processing Midtrans notification:', error.message);
        res.status(500).send('Error');
    }
});


// ==============================
// ADMIN AUTHENTICATION & MIDDLEWARE
// ==============================

// Middleware untuk verifikasi admin token
function verifyAdminToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token tidak ditemukan' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token tidak valid' });
    }
}

// ==============================
// DEBUG ENDPOINTS
// ==============================

// Debug: Test database connection
app.get('/debug/db-test', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute('SELECT SYSDATE FROM dual');

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

// Fixed GET version of setup-admin untuk browser testing
app.get('/debug/setup-admin', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // 1. DROP existing table if exists (untuk clean setup)
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

        // 2. Create admin_users table - SIMPLIFIED VERSION
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

        // 3. Create admin_login_logs table
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

        // 4. Add status column to reservasi if not exists
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

        // 5. Hash password dan insert admin user - SIMPLIFIED
        const passwordHash = await bcrypt.hash('admin123', 10);

        const result = await connection.execute(
            `INSERT INTO admin_users (username, password_hash, is_active)
             VALUES (:username, :password_hash, 1)`,
            {
                username: 'admin',
                password_hash: passwordHash
            }
        );

        await connection.commit();

        // 6. Verify admin user created - SIMPLIFIED QUERY
        const verifyResult = await connection.execute(
            `SELECT id, username, is_active, created_at FROM admin_users WHERE username = 'admin'`
        );

        // HTML response untuk browser
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

// ==============================
// ADMIN ENDPOINTS
// ==============================

// 1. ADMIN LOGIN ENDPOINT
app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;

    console.log('🔐 Admin login attempt:', { username, password: '***' });

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

        // Query SIMPLIFIED - tanpa full_name
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

        // Verify password dengan bcrypt
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

        // Generate JWT token
        const token = jwt.sign(
            {
                id: admin.ID,
                username: admin.USERNAME
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Log login activity
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

// 2. VERIFY ADMIN TOKEN
app.get('/admin/verify', verifyAdminToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

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

// 3. DASHBOARD STATS
app.get('/admin/stats', verifyAdminToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Get total reservasi
        const reservasiResult = await connection.execute(
            `SELECT COUNT(*) as total FROM RESERVASI`
        );

        // Get pending reservasi
        const pendingResult = await connection.execute(
            `SELECT COUNT(*) as pending FROM RESERVASI WHERE STATUS = 'pending' OR STATUS IS NULL`
        );

        // Get total kritik saran
        const kritikResult = await connection.execute(
            `SELECT COUNT(*) as total FROM KRITIKSARAN`
        );

        // Get total kontak
        const kontakResult = await connection.execute(
            `SELECT COUNT(*) as total FROM KONTAK`
        );

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

// 4. RESERVASI MANAGEMENT
app.get('/admin/reservasi', verifyAdminToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

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

// Update reservasi status
app.put('/admin/reservasi/:id/status', verifyAdminToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    console.log('🔄 Update reservasi status:', { id, status });

    if (!['pending', 'accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status tidak valid' });
    }

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Get specific record first berdasarkan posisi
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

        // Update berdasarkan kombinasi unik field
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

// Delete reservasi
app.delete('/admin/reservasi/:id', verifyAdminToken, async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Get specific record first
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

        // Delete berdasarkan kombinasi unik field
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

// 5. KRITIK SARAN MANAGEMENT - FIXED untuk CLOB Oracle
app.get('/admin/kritik-saran', verifyAdminToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Simple query tanpa CASE WHEN untuk CLOB
        const result = await connection.execute(
            `SELECT ID, NAMA, JUDUL, KRITIKSARAN
             FROM KRITIKSARAN
             ORDER BY ID DESC`,
            {},
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
                fetchInfo: {
                    KRITIKSARAN: { type: oracledb.STRING }
                }
            }
        );

        console.log('📊 Kritik saran query result:', result.rows.length, 'rows found');

        const kritikSaran = result.rows.map(row => ({
            id: row.ID,
            nama: row.NAMA,
            judul: row.JUDUL,
            kritikSaran: row.KRITIKSARAN || 'No content',
            tanggal: new Date() // Default date since no created_at
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

// Delete kritik saran
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

// 6. KONTAK MANAGEMENT - FIXED untuk CLOB Oracle
app.get('/admin/kontak', verifyAdminToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Simple query tanpa CASE WHEN untuk CLOB
        const result = await connection.execute(
            `SELECT ID, NAMA, ALAMATEMAIL, SUBJECT, MESSAGE,
                    NVL(CREATED_AT, SYSDATE) as CREATED_AT
             FROM KONTAK
             ORDER BY NVL(CREATED_AT, SYSDATE) DESC`,
            {},
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
                fetchInfo: {
                    MESSAGE: { type: oracledb.STRING }
                }
            }
        );

        console.log('📊 Kontak query result:', result.rows.length, 'rows found');

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

// Delete kontak
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

// ==============================
// Jalankan server
// ==============================
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`📊 Database: ${dbConfig.user}@${dbConfig.connectString}`);
    console.log(`🔗 Midtrans Production Mode: ${snap.apiConfig.isProduction}`);
    console.log(`🔧 Debug endpoints:`);
    console.log(`   - GET  /debug/db-test`);
    console.log(`   - GET  /debug/setup-admin`);
    console.log(`🔐 Admin endpoints:`);
    console.log(`   - POST /admin/login`);
    console.log(`   - GET  /admin/verify`);
    console.log(`   - GET  /admin/stats`);
    console.log(`   - GET  /admin/reservasi`);
    console.log(`   - GET  /admin/kritik-saran`);
    console.log(`   - GET  /admin/kontak`);
    console.log(`💳 Midtrans Payment endpoints:`);
    console.log(`   - GET  /pembayaran (menampilkan form pembayaran, pastikan public/payment.html ada)`);
    console.log(`   - POST /api/payment (membuat transaksi Midtrans)`);
    console.log(`   - POST /api/midtrans-notification (handler notifikasi Midtrans)`);
    console.log(`📝 Form endpoints:`);
    console.log(`   - POST /reservasi`);
    console.log(`   - POST /kritiksaran`);
    console.log(`   - POST /kontakkami`);
    console.log(`   - GET  /check-availability (UPDATED: only accepted)`);
    console.log(`   - GET  /unavailable-dates (UPDATED: only accepted)`);
    console.log(`🎯 Status Logic:`);
    console.log(`   - Pending: Tidak tampil di ketersediaan`);
    console.log(`   - Accepted: Tampil di ketersediaan (villa unavailable)`);
    console.log(`   - Rejected: Tidak tampil di ketersediaan`);
});