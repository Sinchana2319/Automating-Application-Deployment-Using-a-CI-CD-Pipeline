const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// GET /api/services/categories
router.get('/categories', authenticate, (req, res) => {
  const cats = db.prepare("SELECT * FROM service_categories WHERE status = 'active' ORDER BY name").all();
  res.json(cats);
});

// GET /api/services/requests - get client's own requests
router.get('/requests', authenticate, (req, res) => {
  const { status, priority } = req.query;
  let query = `
    SELECT sr.*, sc.name as category_name, sc.icon as category_icon,
           u.name as client_name
    FROM service_requests sr
    JOIN service_categories sc ON sr.category_id = sc.id
    JOIN users u ON sr.client_id = u.id
    WHERE sr.client_id = ?
  `;
  const params = [req.user.id];

  if (status) { query += ' AND sr.status = ?'; params.push(status); }
  if (priority) { query += ' AND sr.priority = ?'; params.push(priority); }
  query += ' ORDER BY sr.created_at DESC';

  const requests = db.prepare(query).all(...params);
  res.json(requests);
});

// GET /api/services/requests/:id
router.get('/requests/:id', authenticate, (req, res) => {
  const request = db.prepare(`
    SELECT sr.*, sc.name as category_name, sc.icon as category_icon, u.name as client_name
    FROM service_requests sr
    JOIN service_categories sc ON sr.category_id = sc.id
    JOIN users u ON sr.client_id = u.id
    WHERE sr.id = ? AND sr.client_id = ?
  `).get(req.params.id, req.user.id);

  if (!request) return res.status(404).json({ error: 'Service request not found.' });

  const updates = db.prepare(`
    SELECT su.*, u.name as updated_by_name, u.role as updated_by_role
    FROM service_updates su
    JOIN users u ON su.updated_by = u.id
    WHERE su.request_id = ?
    ORDER BY su.created_at ASC
  `).all(req.params.id);

  res.json({ ...request, updates });
});

// POST /api/services/requests
router.post('/requests', authenticate, (req, res) => {
  const { category_id, title, description, priority } = req.body;

  if (!category_id || !title) {
    return res.status(400).json({ error: 'Category and title are required.' });
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const reqPriority = validPriorities.includes(priority) ? priority : 'medium';

  try {
    const stmt = db.prepare(`
      INSERT INTO service_requests (client_id, category_id, title, description, priority)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(req.user.id, category_id, title, description || null, reqPriority);

    // Add initial update
    db.prepare(`
      INSERT INTO service_updates (request_id, message, updated_by)
      VALUES (?, ?, ?)
    `).run(info.lastInsertRowid, 'Service request created and submitted.', req.user.id);

    const created = db.prepare(`
      SELECT sr.*, sc.name as category_name FROM service_requests sr
      JOIN service_categories sc ON sr.category_id = sc.id
      WHERE sr.id = ?
    `).get(info.lastInsertRowid);

    res.status(201).json({ message: 'Service request submitted successfully!', request: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit service request.' });
  }
});

// PUT /api/services/requests/:id
router.put('/requests/:id', authenticate, (req, res) => {
  const { title, description, priority } = req.body;
  const request = db.prepare("SELECT * FROM service_requests WHERE id = ? AND client_id = ?").get(req.params.id, req.user.id);

  if (!request) return res.status(404).json({ error: 'Request not found.' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be edited.' });

  db.prepare(`
    UPDATE service_requests SET title = ?, description = ?, priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(title || request.title, description || request.description, priority || request.priority, req.params.id);

  db.prepare("INSERT INTO service_updates (request_id, message, updated_by) VALUES (?, ?, ?)").run(req.params.id, 'Request details updated by client.', req.user.id);

  res.json({ message: 'Request updated successfully.' });
});

// GET /api/services/stats
router.get('/stats', authenticate, (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as cnt FROM service_requests WHERE client_id = ?").get(req.user.id).cnt;
  const pending = db.prepare("SELECT COUNT(*) as cnt FROM service_requests WHERE client_id = ? AND status = 'pending'").get(req.user.id).cnt;
  const inProgress = db.prepare("SELECT COUNT(*) as cnt FROM service_requests WHERE client_id = ? AND status = 'in_progress'").get(req.user.id).cnt;
  const completed = db.prepare("SELECT COUNT(*) as cnt FROM service_requests WHERE client_id = ? AND status = 'completed'").get(req.user.id).cnt;
  res.json({ total, pending, in_progress: inProgress, completed });
});

module.exports = router;
