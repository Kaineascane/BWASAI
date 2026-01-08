const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

const executiveUploadDir = path.join(__dirname, 'public', 'uploads', 'executives');
if (!fs.existsSync(executiveUploadDir)) {
    fs.mkdirSync(executiveUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function(_req, _file, cb) {
        cb(null, executiveUploadDir);
    },
    filename: function(_req, file, cb) {
        const sanitized = file.originalname.replace(/\s+/g, '-');
        cb(null, `${Date.now()}-${sanitized}`);
    }
});

const upload = multer({ storage });

// MySQL Database configuration
// Support both connection string and individual config
let dbConfig;
let pool;

function parseConnectionString(connectionString) {
    const url = new URL(connectionString);
    return {
        host: url.hostname,
        port: url.port || 3306,
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
}

function initDbConfig() {
    const connectionString = process.env.DATABASE_URL || process.env.MYSQL_URL;
    if (connectionString) {
        dbConfig = parseConnectionString(connectionString);
        console.log('✓ Using MySQL connection string');
    } else {
        dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'bwsai',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };
    }
}

async function initDatabase() {
    try {
        initDbConfig();
        const dbName = dbConfig.database;
        
        // First, connect without specifying database to create it if needed
        const tempConfig = { ...dbConfig };
        delete tempConfig.database;
        const tempPool = mysql.createPool(tempConfig);
        
        try {
            const tempConnection = await tempPool.getConnection();
            // Create database if it doesn't exist
            await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            await tempConnection.query(`USE \`${dbName}\``);
            tempConnection.release();
            console.log(`✓ Database '${dbName}' is ready`);
        } catch (createError) {
            tempPool.end();
            throw createError;
        }
        tempPool.end();
        
        // Now connect to the actual database
        pool = mysql.createPool(dbConfig);

        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();

        await createTables();
        await ensureDefaultAccounts();
        await ensureSupportInfoDefaults();
        await ensureExecutivesDefaults();

        console.log('✓ Database connected and initialized successfully');
    } catch (error) {
        console.error('\n❌ Database connection error!');
        console.error('Error details:', error.message);
        console.error('\nPlease make sure:');
        console.error('1. MySQL Server is running and accessible');
        console.error('2. Connection string or credentials are correct');
        console.error('3. Set DATABASE_URL or MYSQL_URL environment variable for connection string');
        console.error('   Format: mysql://user:password@host:port/database');
        console.error('   Or set: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME\n');
        process.exit(1);
    }
}

// Create all tables
async function createTables() {
    const connection = await pool.getConnection();
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin','user') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS consumers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNIQUE,
                name VARCHAR(150) NOT NULL,
                address VARCHAR(255) NOT NULL,
                phone VARCHAR(60),
                email VARCHAR(150),
                allocated_amount DECIMAL(10,2) DEFAULT 0,
                cubic_meters DECIMAL(10,2) DEFAULT 0,
                rate_per_cubic_meter DECIMAL(10,2) DEFAULT 28.00,
                status VARCHAR(30) DEFAULT 'active',
                current_balance DECIMAL(10,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_consumers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS consumer_bills (
                id INT AUTO_INCREMENT PRIMARY KEY,
                consumer_id INT NOT NULL,
                month VARCHAR(20) NOT NULL,
                year INT NOT NULL,
                cubic_meters DECIMAL(10,2) DEFAULT 0,
                rate_per_cubic_meter DECIMAL(10,2) DEFAULT 28.00,
                amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'Pending',
                balance DECIMAL(10,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_bills_consumer FOREIGN KEY (consumer_id) REFERENCES consumers(id) ON DELETE CASCADE,
                CONSTRAINT uq_bills UNIQUE (consumer_id, month, year)
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS support_info (
                id TINYINT PRIMARY KEY,
                organization VARCHAR(150) DEFAULT 'BWSAI Support Desk',
                phone VARCHAR(60) DEFAULT '',
                email VARCHAR(150) DEFAULT '',
                address VARCHAR(255) DEFAULT '',
                facebook_url VARCHAR(255) DEFAULT '',
                hours VARCHAR(120) DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS executives (
                id INT AUTO_INCREMENT PRIMARY KEY,
                position INT NOT NULL UNIQUE,
                name VARCHAR(150) NOT NULL,
                title VARCHAR(100) NOT NULL,
                image_url VARCHAR(500) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);

        // Create indexes
        await connection.query(`
            CREATE INDEX IF NOT EXISTS idx_consumers_user_id ON consumers(user_id)
        `);
    } finally {
        connection.release();
    }
}

// Utility helpers
async function runAsync(sql, params = []) {
    const connection = await pool.getConnection();
    try {
        const [result] = await connection.query(sql, params);
        return { lastID: result.insertId, changes: result.affectedRows };
    } finally {
        connection.release();
    }
}

async function getAsync(sql, params = []) {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query(sql, params);
        return rows[0] || null;
    } finally {
        connection.release();
    }
}

async function allAsync(sql, params = []) {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query(sql, params);
        return rows;
    } finally {
        connection.release();
    }
}

async function ensureSupportInfoDefaults() {
    const existing = await getAsync("SELECT * FROM support_info WHERE id = 1");
    if (!existing) {
        await runAsync("INSERT INTO support_info (id) VALUES (1)");
    }
}

async function getSupportInfo() {
    const info = await getAsync("SELECT * FROM support_info WHERE id = 1");
    if (info) {
        return info;
    }
    await ensureSupportInfoDefaults();
    return getAsync("SELECT * FROM support_info WHERE id = 1");
}

async function ensureExecutivesDefaults() {
    const count = await getAsync("SELECT COUNT(*) as count FROM executives");
    if (count && count.count === 0) {
        // Create 15 default executive positions
        for (let i = 1; i <= 15; i++) {
            await runAsync(
                "INSERT INTO executives (position, name, title) VALUES (?, ?, ?)",
                [i, `Executive ${i}`, `Position ${i}`]
            );
        }
    }
}

async function ensureDefaultAccounts() {
    const admin = await getAsync("SELECT id FROM users WHERE username = ?", ['admin']);
    if (!admin) {
        const hashed = bcrypt.hashSync('Admin@123', 10);
        await runAsync("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)", 
            ['admin', 'admin@bwsai.local', hashed, 'admin']);
        console.log('Default admin created: admin / Admin@123');
    }
    const consumer = await getAsync("SELECT id FROM users WHERE username = ?", ['consumer']);
    if (!consumer) {
        const hashed = bcrypt.hashSync('password123', 10);
        const insert = await runAsync("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
            ['consumer', 'consumer@bwsai.local', hashed, 'user']);
        await ensureConsumerProfile(insert.lastID, 'Default Consumer', 'consumer@bwsai.local');
        console.log('Default consumer created: consumer / password123');
    }
}

// Database will be initialized when server starts

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    return res.redirect('/login');
}

function requireJsonAuth(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    return res.status(401).json({ error: 'Not authenticated' });
}

function requireAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: admin access required' });
    }
    return next();
}

async function checkWaterSupplyStatus(consumerId) {
    // Check if consumer has unpaid bills from previous month
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('en-US', { month: 'long' });
    const currentYear = currentDate.getFullYear();
    
    // Get previous month
    const prevMonthDate = new Date(currentYear, currentDate.getMonth() - 1, 1);
    const prevMonth = prevMonthDate.toLocaleString('en-US', { month: 'long' });
    const prevYear = prevMonthDate.getFullYear();
    
    const prevMonthBill = await getAsync(
        "SELECT * FROM consumer_bills WHERE consumer_id = ? AND month = ? AND year = ?",
        [consumerId, prevMonth, prevYear]
    );
    
    // If previous month bill exists and is not paid, cut off water supply
    if (prevMonthBill && prevMonthBill.status !== 'Paid') {
        await runAsync("UPDATE consumers SET status = 'cut_off' WHERE id = ?", [consumerId]);
        return 'cut_off';
    }
    
    // Check if there are any unpaid bills older than current month
    const unpaidBills = await allAsync(
        `SELECT * FROM consumer_bills 
         WHERE consumer_id = ? 
         AND status != 'Paid' 
         AND (year < ? OR (year = ? AND month != ?))
         ORDER BY year DESC, month DESC
         LIMIT 1`,
        [consumerId, currentYear, currentYear, currentMonth]
    );
    
    if (unpaidBills.length > 0) {
        await runAsync("UPDATE consumers SET status = 'cut_off' WHERE id = ?", [consumerId]);
        return 'cut_off';
    }
    
    // If all bills are paid, ensure status is active
    const consumer = await getAsync("SELECT status FROM consumers WHERE id = ?", [consumerId]);
    if (consumer && consumer.status === 'cut_off') {
        await runAsync("UPDATE consumers SET status = 'active' WHERE id = ?", [consumerId]);
    }
    
    return 'active';
}

async function ensureConsumerProfile(userId, username, email) {
    if (!userId) return null;
    try {
        const existing = await getAsync("SELECT * FROM consumers WHERE user_id = ?", [userId]);
        if (existing) {
            // Check water supply status
            await checkWaterSupplyStatus(existing.id);
            return getAsync("SELECT * FROM consumers WHERE id = ?", [existing.id]);
        }
        const name = username || 'Consumer';
        const address = 'Pending address update';
        const insert = await runAsync(`INSERT INTO consumers 
            (user_id, name, address, phone, email, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, name, address, '', email || '', 'active']);
        return getAsync("SELECT * FROM consumers WHERE id = ?", [insert.lastID]);
    } catch (error) {
        throw error;
    }
}

async function getConsumerByUser(userId, username, email) {
    const consumer = await ensureConsumerProfile(userId, username, email);
    return consumer;
}

async function getBillsForConsumer(consumerId) {
    const bills = await allAsync(`SELECT id, month, year, cubic_meters, rate_per_cubic_meter, amount, status, balance
                                  FROM consumer_bills
                                  WHERE consumer_id = ?
                                  ORDER BY year DESC, id DESC`, [consumerId]);
    return bills;
}

function getDueAmount(bill) {
    const balanceValue = parseFloat(bill.balance || 0);
    if (bill.status === 'Paid') {
        return 0;
    }
    if (balanceValue > 0) {
        return balanceValue;
    }
    return parseFloat(bill.amount || 0);
}

function summarizeBills(bills) {
    const totals = bills.reduce((acc, bill) => {
        const amountValue = parseFloat(bill.amount || 0);
        const due = getDueAmount(bill);
        acc.amount += amountValue;
        acc.cubicMeters += parseFloat(bill.cubic_meters || 0);
        acc.outstanding += due;
        return acc;
    }, { amount: 0, cubicMeters: 0, outstanding: 0 });

    const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' });
    const currentMonthBill = bills.find(b => b.month === currentMonthName);
    const currentBalance = currentMonthBill ? getDueAmount(currentMonthBill) : 0;
    const previousBalance = bills
        .filter(b => b.month !== currentMonthName)
        .reduce((sum, bill) => sum + getDueAmount(bill), 0);

    return {
        totals,
        balanceSummary: {
            previousBalance,
            currentMonth: currentMonthBill ? currentMonthBill.month : currentMonthName,
            currentBalance,
            totalBalance: previousBalance + currentBalance
        }
    };
}

// Routes
app.get('/', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/landing', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Removed /register route - consumers can no longer register

app.get('/dashboard', requireAuth, (req, res) => {
    if (req.session.role === 'admin') {
        return res.redirect('/dashboard/admin');
    }
    return res.redirect('/dashboard/user');
});

const serveAdminPage = (page) => [
    requireAuth,
    (req, res) => {
        if (req.session.role !== 'admin') {
            return res.redirect('/dashboard/user');
        }
        res.sendFile(path.join(__dirname, 'public', 'admin', `${page}.html`));
    }
];

const serveConsumerPage = (page) => [
    requireAuth,
    (req, res) => {
        if (req.session.role === 'admin') {
            return res.redirect('/dashboard/admin');
        }
        res.sendFile(path.join(__dirname, 'public', 'consumer', `${page}.html`));
    }
];

app.get('/dashboard/admin', ...serveAdminPage('dashboard'));
app.get('/dashboard/admin/user-management', ...serveAdminPage('user-management'));
app.get('/dashboard/admin/billing', ...serveAdminPage('billing'));
app.get('/dashboard/admin/reports', ...serveAdminPage('reports'));
app.get('/dashboard/admin/support', ...serveAdminPage('support'));
app.get('/dashboard/admin/settings', ...serveAdminPage('settings'));

app.get('/dashboard/user', ...serveConsumerPage('dashboard'));
app.get('/dashboard/user/usage', ...serveConsumerPage('usage'));
app.get('/dashboard/user/billing', ...serveConsumerPage('billing'));
app.get('/dashboard/user/support', ...serveConsumerPage('support'));
app.get('/dashboard/user/settings', ...serveConsumerPage('settings'));

// API Routes
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await getAsync("SELECT * FROM users WHERE username = ? OR email = ?", [username, username]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValidPassword = bcrypt.compareSync(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role || 'user';
        req.session.userEmail = user.email;

        if (user.role !== 'admin') {
            await ensureConsumerProfile(user.id, user.username, user.email);
        }

        res.json({ 
            success: true, 
            user: { 
                id: user.id, 
                username: user.username, 
                email: user.email,
                role: req.session.role
            } 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Removed /api/register route - consumers can no longer register

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true });
    });
});

app.get('/api/user', requireJsonAuth, async (req, res) => {
    try {
        const user = await getAsync("SELECT id, username, email, role, created_at FROM users WHERE id = ?", [req.session.userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.role = user.role || 'user';
        let consumerProfile = null;
        if (user.role !== 'admin') {
            const profile = await getConsumerByUser(user.id, user.username, user.email);
            if (profile) {
                consumerProfile = {
                    id: profile.id,
                    name: profile.name,
                    address: profile.address,
                    phone: profile.phone || '',
                    email: profile.email || user.email,
                    status: profile.status,
                    current_balance: profile.current_balance || 0
                };
            }
        }
        res.json({ user, consumer: consumerProfile });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/user/usage', requireJsonAuth, async (req, res) => {
    try {
        const user = await getAsync("SELECT username, email FROM users WHERE id = ?", [req.session.userId]);
        const consumer = await getConsumerByUser(req.session.userId, user?.username, user?.email);
        if (!consumer) {
            return res.json({ usage: [], totals: { amount: 0, cubicMeters: 0 }, currency: 'PHP' });
        }

        const bills = await getBillsForConsumer(consumer.id);
        const insights = summarizeBills(bills);
        const usage = bills.map((bill, index) => ({
            id: bill.id,
            month: bill.month,
            reference: `${bill.month} ${bill.year}`,
            cubicMeters: parseFloat(bill.cubic_meters || 0),
            amountPeso: parseFloat(bill.amount || 0),
            status: bill.status,
            balance: parseFloat(bill.balance || 0),
            dueAmount: getDueAmount(bill),
            dueDate: `${bill.year}-${String(index + 1).padStart(2, '0')}-25`
        }));

        // Calculate usage growth
        const usageGrowth = calculateUsageGrowth(bills);

        res.json({
            usage,
            totals: insights.totals,
            balance: insights.balanceSummary,
            currency: 'PHP',
            growth: usageGrowth
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to load usage data' });
    }
});

function calculateUsageGrowth(bills) {
    if (bills.length < 2) {
        return { trend: 'stable', percentage: 0, message: 'Insufficient data' };
    }
    
    // Sort by year and month
    const sortedBills = [...bills].sort((a, b) => {
        const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        if (a.year !== b.year) return b.year - a.year;
        return monthOrder.indexOf(b.month) - monthOrder.indexOf(a.month);
    });
    
    const recent = sortedBills.slice(0, 3);
    const previous = sortedBills.slice(3, 6);
    
    if (previous.length === 0) {
        return { trend: 'stable', percentage: 0, message: 'Insufficient data' };
    }
    
    const recentAvg = recent.reduce((sum, b) => sum + parseFloat(b.cubic_meters || 0), 0) / recent.length;
    const previousAvg = previous.reduce((sum, b) => sum + parseFloat(b.cubic_meters || 0), 0) / previous.length;
    
    if (previousAvg === 0) {
        return { trend: 'stable', percentage: 0, message: 'No previous data' };
    }
    
    const percentage = ((recentAvg - previousAvg) / previousAvg) * 100;
    const trend = percentage > 5 ? 'increasing' : percentage < -5 ? 'decreasing' : 'stable';
    
    return {
        trend,
        percentage: Math.round(percentage * 10) / 10,
        message: percentage > 5 ? 'Water usage is increasing' : 
                 percentage < -5 ? 'Water usage is decreasing' : 
                 'Water usage is stable'
    };
}

app.put('/api/user/profile', requireJsonAuth, async (req, res) => {
    const { username, email, phone, address } = req.body || {};
    const trimmedName = (username || '').trim();
    const trimmedEmail = (email || '').trim();
    if ((req.session.role || 'user') !== 'admin') {
        return res.status(403).json({ error: 'Only administrators can update profile information from this screen.' });
    }
    if (!trimmedName || !trimmedEmail) {
        return res.status(400).json({ error: 'Username and email are required.' });
    }
    try {
        const existingUserByName = await getAsync("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?", [trimmedName, req.session.userId]);
        if (existingUserByName) {
            return res.status(400).json({ error: 'Username is already in use.' });
        }
        const existingUserByEmail = await getAsync("SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?", [trimmedEmail, req.session.userId]);
        if (existingUserByEmail) {
            return res.status(400).json({ error: 'Email is already registered.' });
        }
        await runAsync("UPDATE users SET username = ?, email = ? WHERE id = ?", [trimmedName, trimmedEmail, req.session.userId]);
        req.session.username = trimmedName;
        req.session.userEmail = trimmedEmail;
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to update profile.' });
    }
});

app.put('/api/user/password', requireJsonAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }
    try {
        const user = await getAsync("SELECT id, password FROM users WHERE id = ?", [req.session.userId]);
        if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(400).json({ error: 'Current password is incorrect.' });
        }
        const hashed = bcrypt.hashSync(newPassword, 10);
        await runAsync("UPDATE users SET password = ? WHERE id = ?", [hashed, req.session.userId]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to update password.' });
    }
});

app.get('/api/support', async (req, res) => {
    try {
        const support = await getSupportInfo();
        res.json({ support });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to load support information.' });
    }
});

app.put('/api/support', requireAdmin, async (req, res) => {
    const { organization, phone, email, address, facebook_url, hours } = req.body || {};
    try {
        await ensureSupportInfoDefaults();
        await runAsync(`UPDATE support_info 
                        SET organization = ?, phone = ?, email = ?, address = ?, facebook_url = ?, hours = ?, updated_at = CURRENT_TIMESTAMP 
                        WHERE id = 1`,
            [
                (organization || '').trim(),
                (phone || '').trim(),
                (email || '').trim(),
                (address || '').trim(),
                (facebook_url || '').trim(),
                (hours || '').trim()
            ]);
        const support = await getSupportInfo();
        res.json({ support });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to update support information.' });
    }
});

// Executive Board APIs
app.get('/api/executives', async (req, res) => {
    try {
        const executives = await allAsync("SELECT * FROM executives ORDER BY position ASC");
        res.json({ executives });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to load executives' });
    }
});

app.post('/api/executives/:id/photo', requireAdmin, upload.single('photo'), async (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'Photo file is required.' });
    }
    const relativePath = `/uploads/executives/${req.file.filename}`;
    try {
        await runAsync("UPDATE executives SET image_url = ? WHERE id = ?", [relativePath, id]);
        res.json({ success: true, path: relativePath });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to upload executive photo' });
    }
});

app.put('/api/executives/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, title, image_url, imagePath } = req.body;
    const finalImage = image_url || imagePath || '';
    try {
        await runAsync("UPDATE executives SET name = ?, title = ?, image_url = COALESCE(?, image_url) WHERE id = ?", 
            [name, title, finalImage || null, id]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to update executive' });
    }
});

app.get('/api/admin/metrics', requireAdmin, async (req, res) => {
    try {
        const userStats = await getAsync("SELECT COUNT(*) as total_users FROM users WHERE role != 'admin'");
        const consumerStats = await getAsync(`SELECT COUNT(*) as total_consumers, 
                                                     SUM(allocated_amount) as total_allocated, 
                                                     SUM(cubic_meters) as total_cubic_meters
                                              FROM consumers`);
        const activeStats = await getAsync("SELECT COUNT(*) as active_consumers FROM consumers WHERE status = 'active'");
        
        // Calculate total revenue from bills
        const revenueStats = await getAsync(`SELECT SUM(amount) as total_revenue 
                                             FROM consumer_bills 
                                             WHERE status = 'Paid'`);

        res.json({
            metrics: {
                totalUsers: parseInt(userStats?.total_users || 0),
                totalConsumers: parseInt(consumerStats?.total_consumers || 0),
                totalAllocated: parseFloat(consumerStats?.total_allocated || 0),
                totalCubicMeters: parseFloat(consumerStats?.total_cubic_meters || 0),
                totalRevenue: parseFloat(revenueStats?.total_revenue || 0),
                activeConsumers: parseInt(activeStats?.active_consumers || 0)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to load metrics' });
    }
});

app.get('/api/admin/sales', requireAdmin, async (req, res) => {
    try {
        const bills = await allAsync(`
            SELECT consumer_id, month, year, cubic_meters, rate_per_cubic_meter, amount, balance, status
            FROM consumer_bills
            ORDER BY year DESC, id DESC
        `);
        const formatted = bills.map(bill => ({
            ...bill,
            amount_paid: Math.max(parseFloat(bill.amount || 0) - parseFloat(bill.balance || 0), 0),
            due_amount: getDueAmount(bill)
        }));
        res.json({ bills: formatted });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to load sales data' });
    }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await allAsync(`
            SELECT u.id, u.username, u.email, u.role, u.created_at, 
                   c.id as consumer_id, c.name, c.phone, c.address, c.status
            FROM users u
            LEFT JOIN consumers c ON u.id = c.user_id
            WHERE u.role != 'admin' 
            ORDER BY u.created_at DESC
        `);
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: 'Unable to load users' });
    }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    const { username, email, password, name, address, phone } = req.body;
    if (!username || !email || !password || !address) {
        return res.status(400).json({ error: 'Username, email, password, and address are required' });
    }
    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = await runAsync("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)", 
            [username, email, hashedPassword, 'user']);
        const consumerProfile = await ensureConsumerProfile(result.lastID, name || username, email);
        if (consumerProfile) {
            await runAsync("UPDATE consumers SET name = ?, phone = ?, address = ?, email = ? WHERE id = ?", 
                [name || consumerProfile.name, phone || '', address, email, consumerProfile.id]);
        }
        res.json({ success: true });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        console.error(error);
        res.status(500).json({ error: 'Unable to create consumer account' });
    }
});

// Admin account management endpoints
app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { username, email, password, name, phone, address } = req.body;
    try {
        if (username || email) {
            await runAsync("UPDATE users SET username = COALESCE(?, username), email = COALESCE(?, email) WHERE id = ?", 
                [username || null, email || null, id]);
        }
        if (password) {
            const hashed = bcrypt.hashSync(password, 10);
            await runAsync("UPDATE users SET password = ? WHERE id = ?", [hashed, id]);
        }
        const consumer = await getAsync("SELECT id FROM consumers WHERE user_id = ?", [id]);
        if (consumer && (name || phone || address)) {
            await runAsync("UPDATE consumers SET name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email), address = COALESCE(?, address) WHERE user_id = ?",
                [name || null, phone || null, email || null, address || null, id]);
        }
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to update account' });
    }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await runAsync("DELETE FROM users WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to delete account' });
    }
});

app.get('/api/admin/billing/consumers', requireAdmin, async (req, res) => {
    try {
        const consumers = await allAsync("SELECT id, name, address, phone, email, status FROM consumers ORDER BY name ASC");
        const allBills = await allAsync(`SELECT id, consumer_id, month, year, cubic_meters, rate_per_cubic_meter, amount, status, balance 
                                         FROM consumer_bills ORDER BY year DESC, id DESC`);
        const merged = consumers.map(consumer => {
            const bills = allBills.filter(b => b.consumer_id === consumer.id)
                .map(bill => ({ ...bill, dueAmount: getDueAmount(bill) }));
            const outstanding = bills.reduce((sum, bill) => sum + bill.dueAmount, 0);
            return {
                ...consumer,
                outstanding,
                bills
            };
        });
        res.json({ consumers: merged });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to load billing data' });
    }
});

// Billing management endpoints
app.post('/api/admin/billing', requireAdmin, async (req, res) => {
    const { consumer_id, month, year, cubic_meters, rate_per_cubic_meter, amount, status, balance } = req.body;
    if (!consumer_id || !month || !year || !amount) {
        return res.status(400).json({ error: 'Consumer ID, month, year, and amount are required' });
    }
    try {
        await runAsync(`INSERT INTO consumer_bills (consumer_id, month, year, cubic_meters, rate_per_cubic_meter, amount, status, balance)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE 
                        cubic_meters = VALUES(cubic_meters),
                        rate_per_cubic_meter = VALUES(rate_per_cubic_meter),
                        amount = VALUES(amount),
                        status = VALUES(status),
                        balance = VALUES(balance)`,
            [consumer_id, month, year, cubic_meters || 0, rate_per_cubic_meter || 28.00, amount, status || 'Pending', balance || 0]);
        
        // Check and update water supply status after bill creation
        await checkWaterSupplyStatus(consumer_id);
        
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to save bill' });
    }
});

app.put('/api/admin/billing/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { month, year, cubic_meters, rate_per_cubic_meter, amount, status, balance } = req.body;
    try {
        await runAsync(`UPDATE consumer_bills 
                        SET month = ?, year = ?, cubic_meters = ?, rate_per_cubic_meter = ?, amount = ?, status = ?, balance = ?
                        WHERE id = ?`,
            [month, year, cubic_meters || 0, rate_per_cubic_meter || 28.00, amount, status, balance || 0, id]);
        
        // Check and update water supply status after bill update
        const bill = await getAsync("SELECT consumer_id FROM consumer_bills WHERE id = ?", [id]);
        if (bill) {
            await checkWaterSupplyStatus(bill.consumer_id);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to update bill' });
    }
});

app.get('/api/consumer/billing', requireJsonAuth, async (req, res) => {
    try {
        const user = await getAsync("SELECT username, email FROM users WHERE id = ?", [req.session.userId]);
        const consumer = await getConsumerByUser(req.session.userId, user?.username, user?.email);
        if (!consumer) {
            return res.json({ bills: [], balance: { totalBalance: 0 } });
        }
        const bills = await getBillsForConsumer(consumer.id);
        const billsWithDue = bills.map(bill => ({
            ...bill,
            dueAmount: getDueAmount(bill)
        }));
        const insights = summarizeBills(billsWithDue);
        res.json({
            bills: billsWithDue,
            balance: insights.balanceSummary
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to load consumer billing' });
    }
});

// Legacy consumer endpoints retained for compatibility
app.get('/api/consumers', requireAdmin, async (req, res) => {
    try {
        const consumers = await allAsync("SELECT * FROM consumers ORDER BY name");
        res.json({ consumers });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/consumers/stats', requireAdmin, async (req, res) => {
    try {
        const stats = await getAsync("SELECT COUNT(*) as total_consumers, SUM(allocated_amount) as total_allocated, SUM(cubic_meters) as total_cubic_meters FROM consumers WHERE status = 'active'");
        res.json({ stats });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/consumers', requireAdmin, async (req, res) => {
    const { name, address, phone, email, allocated_amount, cubic_meters, rate_per_cubic_meter } = req.body;
    if (!name || !address) {
        return res.status(400).json({ error: 'Name and address are required' });
    }
    try {
        const result = await runAsync(`INSERT INTO consumers (name, address, phone, email, allocated_amount, cubic_meters, rate_per_cubic_meter) 
                                       VALUES (?, ?, ?, ?, ?, ?, ?)`, 
            [name, address, phone || '', email || '', allocated_amount || 0, cubic_meters || 0, rate_per_cubic_meter || 2.50]);
        res.json({ success: true, id: result.lastID });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.put('/api/consumers/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, address, phone, email, allocated_amount, cubic_meters, rate_per_cubic_meter, status } = req.body;
    try {
        await runAsync(`UPDATE consumers SET name = ?, address = ?, phone = ?, email = ?, allocated_amount = ?, cubic_meters = ?, rate_per_cubic_meter = ?, status = ? WHERE id = ?`, 
            [name, address, phone, email, allocated_amount, cubic_meters, rate_per_cubic_meter, status, id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.delete('/api/consumers/:id', requireAdmin, async (req, res) => {
    try {
        await runAsync("DELETE FROM consumers WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Start server
(async () => {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`\n✓ Server is running on http://localhost:${PORT}`);
            console.log('✓ Default admin: admin / Admin@123');
            console.log('✓ Default consumer: consumer / password123\n');
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
})();
