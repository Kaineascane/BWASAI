-- BWSAI Database Schema
-- Copy and paste this into your MySQL database

CREATE DATABASE IF NOT EXISTS bwsai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bwsai;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Consumers table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Consumer bills table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Support info table
CREATE TABLE IF NOT EXISTS support_info (
    id TINYINT PRIMARY KEY,
    organization VARCHAR(150) DEFAULT 'BWSAI Support Desk',
    phone VARCHAR(60) DEFAULT '',
    email VARCHAR(150) DEFAULT '',
    address VARCHAR(255) DEFAULT '',
    facebook_url VARCHAR(255) DEFAULT '',
    hours VARCHAR(120) DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Executives table
CREATE TABLE IF NOT EXISTS executives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    position INT NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    title VARCHAR(100) NOT NULL,
    image_url VARCHAR(500) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_consumers_user_id ON consumers(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_consumer_id ON consumer_bills(consumer_id);
CREATE INDEX IF NOT EXISTS idx_bills_year_month ON consumer_bills(year, month);

-- Insert default support info
INSERT INTO support_info (id) VALUES (1) ON DUPLICATE KEY UPDATE id = VALUES(id);

-- Insert default executives (15 positions)
INSERT INTO executives (position, name, title) VALUES
(1, 'Executive 1', 'Position 1'),
(2, 'Executive 2', 'Position 2'),
(3, 'Executive 3', 'Position 3'),
(4, 'Executive 4', 'Position 4'),
(5, 'Executive 5', 'Position 5'),
(6, 'Executive 6', 'Position 6'),
(7, 'Executive 7', 'Position 7'),
(8, 'Executive 8', 'Position 8'),
(9, 'Executive 9', 'Position 9'),
(10, 'Executive 10', 'Position 10'),
(11, 'Executive 11', 'Position 11'),
(12, 'Executive 12', 'Position 12'),
(13, 'Executive 13', 'Position 13'),
(14, 'Executive 14', 'Position 14'),
(15, 'Executive 15', 'Position 15')
ON DUPLICATE KEY UPDATE name = VALUES(name), title = VALUES(title);

-- Note: Default admin and consumer accounts will be created automatically by the application
-- Admin: admin / Admin@123
-- Consumer: consumer / password123

