-- 1. Create the database (UTF-8 so names like "Café" are stored correctly)
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS acs_app
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE acs_app;

-- 2. Create the USER table
CREATE TABLE USER (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    account_type ENUM('Individual', 'Business', 'Organisation', 'Administrator') NOT NULL,
    -- Goes up by one on every logout, so older login tokens stop working
    token_version INT NOT NULL DEFAULT 0,
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

-- 5b. Create the CAMPAIGN_SUPPORTER table (who has joined which cause)
CREATE TABLE CAMPAIGN_SUPPORTER (
    user_id INT NOT NULL,
    campaign_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, campaign_id),
    FOREIGN KEY (user_id) REFERENCES USER(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES CAMPAIGN(id) ON DELETE CASCADE
);

-- 6. Insert Seed Data (Test Accounts)
-- All test accounts use the password: Password123!
INSERT INTO USER (full_name, email, password_hash, account_type) VALUES
('Jane Citizen', 'jane.citizen@example.com', '$2b$10$0dNxGYxAN0gNW9YaRT30.erdZl5AEPS9qng2p0d7iEMoCO.co8GRG', 'Individual'),
('Cafe Owner', 'cafe.owner@example.com', '$2b$10$0dNxGYxAN0gNW9YaRT30.erdZl5AEPS9qng2p0d7iEMoCO.co8GRG', 'Business'),
('Green Team', 'greenteam@example.org', '$2b$10$0dNxGYxAN0gNW9YaRT30.erdZl5AEPS9qng2p0d7iEMoCO.co8GRG', 'Organisation'),
('Admin Test', 'admin.test@example.com', '$2b$10$0dNxGYxAN0gNW9YaRT30.erdZl5AEPS9qng2p0d7iEMoCO.co8GRG', 'Administrator');

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

-- 9. Insert Seed Data (Supporters)
INSERT INTO CAMPAIGN_SUPPORTER (user_id, campaign_id) VALUES
(1, 1),
(1, 2),
(2, 3);
