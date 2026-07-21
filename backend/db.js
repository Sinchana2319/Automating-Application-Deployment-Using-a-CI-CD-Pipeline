const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables (MySQL-compatible schema)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role TEXT DEFAULT 'client' CHECK(role IN ('client','admin')),
    company VARCHAR(150),
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS service_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'fas fa-cog',
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS service_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(30) DEFAULT 'pending',
    assigned_to INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES service_categories(id)
  );

  CREATE TABLE IF NOT EXISTS service_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    updated_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES service_requests(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
  );
`);

// Seed default admin user and categories if not exist
const bcrypt = require('bcryptjs');

const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
if (!adminExists) {
  const hash = bcrypt.hashSync('Admin@123', 10);
  db.prepare(`
    INSERT INTO users (name, email, password, role, company)
    VALUES (?, ?, ?, 'admin', 'ServiceHub Inc.')
  `).run('System Admin', 'admin@servicehub.com', hash);
}

const catCount = db.prepare("SELECT COUNT(*) as cnt FROM service_categories").get();
if (catCount.cnt === 0) {
  const insertCat = db.prepare("INSERT INTO service_categories (name, description, icon) VALUES (?, ?, ?)");
  insertCat.run('Web Development', 'Website design, development, and maintenance services', 'fas fa-code');
  insertCat.run('Digital Marketing', 'SEO, social media, and online advertising services', 'fas fa-bullhorn');
  insertCat.run('IT Support', 'Technical support, network, and infrastructure services', 'fas fa-headset');
  insertCat.run('Graphic Design', 'Logo, branding, and visual design services', 'fas fa-palette');
  insertCat.run('Cloud Services', 'Cloud hosting, migration, and management services', 'fas fa-cloud');
  insertCat.run('Consulting', 'Business and technology consulting services', 'fas fa-briefcase');
}

module.exports = db;
