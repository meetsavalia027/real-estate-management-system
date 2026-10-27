-- Real Estate Management System: database schema (MySQL 8 version)
-- The running project uses the same tables in SQLite (server/src/db.js) so that
-- it needs no database server. This file shows the equivalent MySQL design.

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  phone         VARCHAR(15),
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('buyer','tenant','owner','agent','builder','admin') NOT NULL,
  city          VARCHAR(80),
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE properties (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  owner_id             INT NOT NULL,
  title                VARCHAR(120) NOT NULL,
  description          TEXT,
  listing_type         ENUM('sale','rent') NOT NULL,
  property_type        ENUM('apartment','house','villa','plot','office','shop') NOT NULL,
  price                BIGINT NOT NULL,
  city                 VARCHAR(80) NOT NULL,
  locality             VARCHAR(120) NOT NULL,
  address              VARCHAR(255),
  bedrooms             TINYINT NOT NULL DEFAULT 0,
  bathrooms            TINYINT NOT NULL DEFAULT 0,
  area_sqft            INT NOT NULL,
  furnishing           ENUM('unfurnished','semi-furnished','furnished') NOT NULL DEFAULT 'unfurnished',
  status               ENUM('pending','approved','rejected','sold','rented') NOT NULL DEFAULT 'pending',
  rejection_reason     VARCHAR(255),
  is_duplicate_suspect TINYINT(1) NOT NULL DEFAULT 0,
  duplicate_of         INT,
  views                INT NOT NULL DEFAULT 0,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_properties_search (status, city, listing_type, property_type, price)
);

CREATE TABLE property_images (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  url         VARCHAR(255) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE favourites (
  user_id     INT NOT NULL,
  property_id INT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, property_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE enquiries (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  sender_id   INT NOT NULL,
  receiver_id INT NOT NULL,
  status      ENUM('open','replied','closed') NOT NULL DEFAULT 'open',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE enquiry_messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  enquiry_id INT NOT NULL,
  sender_id  INT NOT NULL,
  body       TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  type       VARCHAR(40) NOT NULL,
  message    VARCHAR(255) NOT NULL,
  link       VARCHAR(255),
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE flags (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  reporter_id INT NOT NULL,
  reason      ENUM('fake','duplicate','wrong_info','not_available','other') NOT NULL,
  details     VARCHAR(500),
  status      ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_flag (property_id, reporter_id),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);
