# BWSAI Utility Portal

A modern, responsive web application with role-aware dashboards for the Barangay Water Smart Access Interface (BWSAI) built with Node.js, Express, and SQLite.

## Features

### 🔐 Authentication System
- Role-based sessions for Admins and Users
- User registration and login
- Secure password hashing with bcrypt
- Session-based authentication
- Password strength validation
- Remember me functionality

### 📊 Dashboard Features
- Rebranded BWSAI landing page with slideshow, CTAs, and contact panel
- Animated lazy-loading screen with spinning logo
- Distinct Admin and Consumer portals with independent navigation
- Admin console for user management, analytics, billing oversight, and report shortcuts
- Consumer dashboard with hero slideshow, usage analytics, and drop-down billing histories
- Interactive statistics cards, Chart.js visualizations, and collapsible side-panels
- Profile dropdowns with account settings and logout on both portals

### 🛡️ Security Features
- Password hashing with bcrypt
- Session management
- Input validation
- SQL injection protection
- XSS protection

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Bootstrap 5, Font Awesome
- **Charts**: Chart.js
- **Authentication**: Express Session, bcryptjs

## Installation

1. **Clone or download the project files**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Open your browser and go to `http://localhost:3000`
   - The application will automatically redirect to the login page

## Default Login Credentials

These baseline accounts are provisioned automatically the first time you run the server:

- **Consumer portal** – `consumer` / `password123`
- **Admin console** – `admin` / `Admin@123`

Change both credentials immediately in production environments.

## Project Structure

```
├── server.js                # Main Express + SQLite server
├── package.json             # Dependencies and scripts
├── users.db                 # SQLite database (auto-created)
├── public/
│   ├── assets/              # Shared assets (logo, etc.)
│   ├── css/                 # Admin & consumer styles
│   ├── js/                  # Client-side logic
│   ├── admin/               # Admin console pages
│   ├── consumer/            # Consumer portal pages
│   ├── landing.html         # Marketing/landing page
│   ├── loading.html         # Lazy-loading splash screen
│   ├── login.html           # Auth page
│   └── register.html        # Registration page
└── README.md                # This file
```

## API Endpoints

### Authentication & Profile
- `POST /api/login` / `POST /api/register` / `POST /api/logout`
- `GET /api/user` – current user info (includes consumer profile if applicable)
- `PUT /api/user/profile` – update the logged-in administrator profile
- `PUT /api/user/password` – change password

### Pages
- `GET /` - Lazy-loading splash that routes to landing or dashboards
- `GET /landing` - Public landing page
- `GET /login` / `GET /register` - Auth pages
- `GET /dashboard/admin` - Admin console (requires admin role)
- `GET /dashboard/user` - Consumer dashboard (requires login)

### Admin APIs
- `GET /api/admin/metrics` - Aggregated usage metrics
- `GET /api/admin/users` - List consumer accounts
- `POST /api/admin/users` - Create a consumer login
- `GET /api/admin/billing/consumers` - Consumer billing board

### Support APIs
- `GET /api/support` - Public support contact info
- `PUT /api/support` - Update support channels (admin only)

### Consumer APIs
- `GET /api/user/usage` - Usage insights for the logged-in consumer
- `GET /api/consumer/billing` - Monthly billing records with balances

## Database Schema

The application automatically provisions the following tables:

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE consumers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    allocated_amount REAL DEFAULT 0,
    cubic_meters REAL DEFAULT 0,
    rate_per_cubic_meter REAL DEFAULT 2.50,
    status TEXT DEFAULT 'active',
    current_balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE consumer_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consumer_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    cubic_meters REAL,
    amount REAL NOT NULL,
    status TEXT NOT NULL,
    balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### MySQL Schema (copy/paste)

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE consumers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NOT NULL,
    phone VARCHAR(60),
    email VARCHAR(150),
    allocated_amount DECIMAL(10,2) DEFAULT 0,
    cubic_meters DECIMAL(10,2) DEFAULT 0,
    rate_per_cubic_meter DECIMAL(10,2) DEFAULT 2.50,
    status VARCHAR(30) DEFAULT 'active',
    current_balance DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_consumers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE consumer_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    consumer_id INT NOT NULL,
    month VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    cubic_meters DECIMAL(10,2) DEFAULT 0,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(30) NOT NULL,
    balance DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bills_consumer FOREIGN KEY (consumer_id) REFERENCES consumers(id) ON DELETE CASCADE,
    CONSTRAINT uq_bills UNIQUE (consumer_id, month, year)
) ENGINE=InnoDB;

CREATE TABLE support_info (
    id TINYINT PRIMARY KEY,
    organization VARCHAR(150),
    phone VARCHAR(60),
    email VARCHAR(150),
    address VARCHAR(255),
    facebook_url VARCHAR(255),
    hours VARCHAR(120),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO support_info (id) VALUES (1) ON DUPLICATE KEY UPDATE id = VALUES(id);
```

### Database Maintenance

- The SQLite file `users.db` is created automatically the first time you run `npm start`.
- To reset the environment, stop the server, delete `users.db`, and start again — the schema plus default accounts/support info will be recreated.

## Customization

### Changing the Database
If you want to use your existing database:

1. Replace the database connection in `server.js`
2. Update the table structure to match your schema
3. Modify the authentication queries accordingly

### Styling
- The application uses Bootstrap 5 for responsive design
- Custom CSS is included in each HTML file
- You can modify colors by changing CSS variables in the `:root` selector

### Adding Features
- The dashboard is modular and easy to extend
- You can add new pages by creating new routes in `server.js`
- Charts can be customized by modifying the Chart.js configuration

## Security Considerations

- Change the session secret in production
- Use HTTPS in production
- Implement rate limiting for login attempts
- Add password reset functionality
- Consider using environment variables for sensitive data

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Troubleshooting

### Common Issues

1. **Port already in use**
   - Change the port in `server.js` (line 9)
   - Or kill the process using the port

2. **Database errors**
   - Delete `users.db` and restart the application
   - Check file permissions

3. **Dependencies not found**
   - Run `npm install` again
   - Check Node.js version (requires 14+)

### Development Tips

- Use `npm run dev` for development with auto-restart
- Check browser console for JavaScript errors
- Monitor server logs for backend issues

## License

This project is open source and available under the MIT License.

## Support

If you encounter any issues or have questions, please check the troubleshooting section above or create an issue in the project repository. 