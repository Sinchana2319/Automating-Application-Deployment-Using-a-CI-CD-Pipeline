const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, adminOnly } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

router.use(authenticate, adminOnly);

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const totalClients = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'client'").get().cnt;
  const totalRequests = db.prepare("SELECT COUNT(*) as cnt FROM service_requests").get().cnt;
  const pending = db.prepare("SELECT COUNT(*) as cnt FROM service_requests WHERE status = 'pending'").get().cnt;
  const inProgress = db.prepare("SELECT COUNT(*) as cnt FROM service_requests WHERE status = 'in_progress'").get().cnt;
  const completed = db.prepare("SELECT COUNT(*) as cnt FROM service_requests WHERE status = 'completed'").get().cnt;
  const categories = db.prepare("SELECT COUNT(*) as cnt FROM service_categories WHERE status = 'active'").get().cnt;
  res.json({ totalClients, totalRequests, pending, in_progress: inProgress, completed, categories });
});

// GET /api/admin/clients
router.get('/clients', (req, res) => {
  const clients = db.prepare(`
    SELECT u.id, u.name, u.email, u.company, u.phone, u.status, u.created_at,
           COUNT(sr.id) as request_count
    FROM users u
    LEFT JOIN service_requests sr ON u.id = sr.client_id
    WHERE u.role = 'client'
    GROUP BY u.id ORDER BY u.created_at DESC
  `).all();
  res.json(clients);
});

// PUT /api/admin/clients/:id/status
router.put('/clients/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare("UPDATE users SET status = ? WHERE id = ? AND role = 'client'").run(status, req.params.id);
  res.json({ message: `Client ${status} successfully.` });
});

// GET /api/admin/requests
router.get('/requests', (req, res) => {
  const { status, priority, client_id } = req.query;
  let query = `
    SELECT sr.*, sc.name as category_name, u.name as client_name, u.company
    FROM service_requests sr
    JOIN service_categories sc ON sr.category_id = sc.id
    JOIN users u ON sr.client_id = u.id WHERE 1=1
  `;
  const params = [];
  if (status) { query += ' AND sr.status = ?'; params.push(status); }
  if (priority) { query += ' AND sr.priority = ?'; params.push(priority); }
  if (client_id) { query += ' AND sr.client_id = ?'; params.push(client_id); }
  query += ' ORDER BY sr.created_at DESC';

  const requests = db.prepare(query).all(...params);
  res.json(requests);
});

// PUT /api/admin/requests/:id/status
router.put('/requests/:id/status', (req, res) => {
  const { status, notes } = req.body;
  const validStatuses = ['pending', 'in_progress', 'on_hold', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  const request = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found.' });

  db.prepare("UPDATE service_requests SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, notes || request.notes, req.params.id);
  db.prepare("INSERT INTO service_updates (request_id, message, updated_by) VALUES (?, ?, ?)").run(
    req.params.id,
    notes ? `Status updated to "${status}". Note: ${notes}` : `Status updated to "${status}".`,
    req.user.id
  );

  res.json({ message: 'Request status updated.' });
});

// GET /api/admin/categories
router.get('/categories', (req, res) => {
  const cats = db.prepare("SELECT * FROM service_categories ORDER BY created_at DESC").all();
  res.json(cats);
});

// POST /api/admin/categories
router.post('/categories', (req, res) => {
  const { name, description, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required.' });

  try {
    const info = db.prepare("INSERT INTO service_categories (name, description, icon) VALUES (?, ?, ?)").run(name, description || null, icon || 'fas fa-cog');
    const cat = db.prepare("SELECT * FROM service_categories WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ message: 'Category created.', category: cat });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

// PUT /api/admin/categories/:id
router.put('/categories/:id', (req, res) => {
  const { name, description, icon, status } = req.body;
  const cat = db.prepare("SELECT * FROM service_categories WHERE id = ?").get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found.' });

  db.prepare("UPDATE service_categories SET name = ?, description = ?, icon = ?, status = ? WHERE id = ?").run(
    name || cat.name, description || cat.description, icon || cat.icon, status || cat.status, req.params.id
  );
  res.json({ message: 'Category updated.' });
});

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', (req, res) => {
  const inUse = db.prepare("SELECT COUNT(*) as cnt FROM service_requests WHERE category_id = ?").get(req.params.id).cnt;
  if (inUse > 0) {
    db.prepare("UPDATE service_categories SET status = 'inactive' WHERE id = ?").run(req.params.id);
    return res.json({ message: 'Category deactivated (has existing requests).' });
  }
  db.prepare("DELETE FROM service_categories WHERE id = ?").run(req.params.id);
  res.json({ message: 'Category deleted.' });
});

module.exports = router;
