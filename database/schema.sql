-- 1. Create the database
CREATE DATABASE IF NOT EXISTS social_awareness_app;
USE social_awareness_app;

-- 2. Create the USER table
CREATE TABLE USER (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    account_type ENUM('Individual', 'Business', 'Organisation', 'Administrator') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Create the CAMPAIGN table
CREATE TABLE CAMPAIGN (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    short_description TEXT NOT NULL,
    image_url VARCHAR(255),
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES USER(id) ON DELETE CASCADE
);

-- 4. Create the BUSINESS_PROMOTION table
CREATE TABLE BUSINESS_PROMOTION (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES USER(id) ON DELETE CASCADE
);

-- 5. Create the MODERATION_LOG table
CREATE TABLE MODERATION_LOG (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    target_type ENUM('Campaign', 'BusinessPromotion') NOT NULL,
    target_id INT NOT NULL,
    decision ENUM('Approved', 'Rejected') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES USER(id) ON DELETE CASCADE
);

-- 6. Insert Seed Data (Test Accounts)
INSERT INTO USER (full_name, email, password_hash, account_type) VALUES
('Jane Citizen', 'jane.citizen@example.com', '$2b$10$dummyHashPassw0rd!', 'Individual'),
('Cafe Owner', 'cafe.owner@example.com', '$2b$10$dummyHashBus1ness!', 'Business'),
('Green Team', 'greenteam@example.org', '$2b$10$dummyHashGr33nTeam!', 'Organisation'),
('Admin Test', 'admin.test@example.com', '$2b$10$dummyHashAdm1nTest!', 'Administrator');

-- 7. Insert Seed Data (Campaigns)
INSERT INTO CAMPAIGN (user_id, title, category, short_description, status) VALUES
(3, 'Greener Communities', 'Environment', 'Local environmental initiative.', 'Approved'),
(3, 'Education for All', 'Education', 'Providing school supplies.', 'Approved'),
(1, 'Stronger Together', 'Community', 'Community support network.', 'Approved'),
(3, 'Beach Clean-up Day', 'Environment', 'Weekend beach cleaning.', 'Pending'),
(1, 'Winter Coat Drive', 'Community', 'Collecting winter coats.', 'Rejected');

-- 8. Insert Seed Data (Business Promotions)
INSERT INTO BUSINESS_PROMOTION (user_id, business_name, category, status) VALUES
(2, 'Corner Café', 'Food and drink', 'Approved'),
(2, 'Spring Garden Sale', 'Retail', 'Pending');