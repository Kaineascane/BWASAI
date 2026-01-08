# Setup Guide for BWSAI

## Prerequisites

1. **Node.js** (v14 or higher) - Already installed ✓
2. **MySQL Server** - Needs to be installed and running

## MySQL Setup

### Option 1: Install MySQL (Recommended)

1. Download MySQL from: https://dev.mysql.com/downloads/mysql/
2. Install MySQL Server
3. During installation, set a root password (remember this!)
4. Make sure MySQL service is running

### Option 2: Use XAMPP (Easier for Windows)

1. Download XAMPP from: https://www.apachefriends.org/
2. Install XAMPP
3. Start MySQL from XAMPP Control Panel
4. Default MySQL root password is usually empty (blank)

## Configure Database Connection

The server uses these default MySQL settings:
- **Host:** localhost
- **User:** root
- **Password:** (empty/blank by default)
- **Database:** bwsai (will be created automatically)

### If your MySQL has a different password:

Create a `.env` file in the project root (or set environment variables):

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bwsai
```

## Start the Application

1. Make sure MySQL is running
2. Run: `npm start`
3. Open browser: http://localhost:3000

## Default Login Credentials

- **Admin:** username: `admin` / password: `Admin@123`
- **Consumer:** username: `consumer` / password: `password123`

## Troubleshooting

### "Cannot connect to MySQL"
- Make sure MySQL service is running
- Check if MySQL is on port 3306 (default)
- Verify username/password in server.js or .env file

### "Access denied for user"
- Check MySQL root password
- Update DB_PASSWORD in .env or server.js

### Port 3000 already in use
- Change PORT in server.js (line 9)
- Or kill the process using port 3000


