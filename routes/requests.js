const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const db       = require('../db');

// ── Multer setup ──────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ── GET /api/requests ─────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        dr.id,
        dr.title,
        dr.request_type,
        dr.requested_by_user_id,
        requester.name  AS requested_by,
        dr.department,
        dr.priority,
        dr.due_date,
        dr.status,
        dr.created_at,
        DATEDIFF(CURDATE(), DATE(dr.created_at)) AS aging_days,
        pending_user.name  AS current_pending_approver,
        pending_user.email AS current_pending_email
      FROM document_requests dr
      JOIN users requester ON requester.id = dr.requested_by_user_id
      LEFT JOIN approvers a
        ON  a.document_request_id = dr.id
        AND a.status   = 'Pending'
        AND a.sequence = (
              SELECT MIN(a2.sequence)
              FROM   approvers a2
              WHERE  a2.document_request_id = dr.id
              AND    a2.status = 'Pending'
            )
      LEFT JOIN users pending_user ON pending_user.id = a.user_id
      ORDER BY dr.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

//GET /api/requests/:id
router.get('/:id', async (req, res) => {
  try {
    const [[request]] = await db.query(
      `SELECT dr.*, requester.name AS requested_by, requester.email AS requested_by_email
       FROM document_requests dr
       JOIN users requester ON requester.id = dr.requested_by_user_id
       WHERE dr.id = ?`,
      [req.params.id]
    );
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const [approvers] = await db.query(
      `SELECT a.*, u.name AS approver_name, u.email AS approver_email, u.department AS approver_department
       FROM approvers a
       JOIN users u ON u.id = a.user_id
       WHERE a.document_request_id = ?
       ORDER BY a.sequence ASC`,
      [req.params.id]
    );
    res.json({ ...request, approvers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// POST /api/requests
// Create request + insert approvers + set Pending Approval in one transaction.
// approvers field: JSON string array of { user_id, role }
router.post('/', upload.single('pdf'), async (req, res) => {
  const {
    requested_by_user_id, request_type, department,
    title, priority, due_date, external_party_name,
    external_party_contact, remarks, approvers,
  } = req.body;

  if (!title || !request_type || !requested_by_user_id || !department || !req.file) {
    return res.status(400).json({ error: 'missing params' });
  }

  let approverList = [];
  try {
    approverList = JSON.parse(approvers || '[]');
  } catch {
    return res.status(400).json({ error: 'approvers must be a valid JSON array' });
  }
  if (!approverList.length) {
    return res.status(400).json({ error: 'At least one approver is required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Insert request as Pending Approval directly
    const [result] = await conn.query(
      `INSERT INTO document_requests
        (title, request_type, requested_by_user_id, department, priority,
         due_date, external_party_name, external_party_contact,
         pdf_filename, pdf_original_name, remarks, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Approval')`,
      [
        title, request_type, requested_by_user_id, department,
        priority || 'Medium',
        due_date || null,
        external_party_name    || null,
        external_party_contact || null,
        req.file.filename,
        req.file.originalname,
        remarks || null,
      ]
    );
    const requestId = result.insertId;

    // Insert approvers with auto-sequence
    const seenUsers = new Set();
    for (let i = 0; i < approverList.length; i++) {
      const { user_id, role } = approverList[i];
      if (!user_id) { await conn.rollback(); return res.status(400).json({ error: 'Each approver must have a user_id' }); }
      if (seenUsers.has(String(user_id))) { await conn.rollback(); return res.status(400).json({ error: 'Duplicate approver in list' }); }
      seenUsers.add(String(user_id));

      await conn.query(
        `INSERT INTO approvers (document_request_id, user_id, role, sequence, status)
         VALUES (?, ?, ?, ?, 'Pending')`,
        [requestId, user_id, role || 'Approver', i + 1]
      );
    }

    await conn.commit();
    res.status(201).json({ id: requestId, message: 'Request submitted for approval' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to create request' });
  } finally {
    conn.release();
  }
});

// POST /api/requests/approve/:id 
// Approve or Reject an approver row.
// Body: { user_id, action: 'Approved'|'Rejected', comments }
router.post('/approve/:id', async (req, res) => {
  const { user_id, action, comments } = req.body;

  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  if (!['Approved', 'Rejected'].includes(action)) {
    return res.status(400).json({ error: "action must be 'Approved' or 'Rejected'" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[approver]] = await conn.query(
      'SELECT * FROM approvers WHERE id = ?',
      [req.params.id]
    );
    if (!approver) { await conn.rollback(); return res.status(404).json({ error: 'Approver not found' }); }
    if (approver.status !== 'Pending') {
      await conn.rollback();
      return res.status(400).json({ error: 'This approver has already acted' });
    }
    if (String(approver.user_id) !== String(user_id)) {
      await conn.rollback();
      return res.status(403).json({ error: 'You are not the approver on this row' });
    }

    // Check sequence
    const [[{ minSeq }]] = await conn.query(
      `SELECT MIN(sequence) AS minSeq FROM approvers
       WHERE document_request_id = ? AND status = 'Pending'`,
      [approver.document_request_id]
    );
    if (approver.sequence !== minSeq) {
      await conn.rollback();
      return res.status(403).json({ error: 'Previous approver must act first.' });
    }

    await conn.query(
      'UPDATE approvers SET status = ?, comments = ? WHERE id = ?',
      [action, comments || null, req.params.id]
    );

    if (action === 'Rejected') {
      await conn.query(
        "UPDATE document_requests SET status = 'Rejected' WHERE id = ?",
        [approver.document_request_id]
      );
    } else {
      const [[{ remaining }]] = await conn.query(
        `SELECT COUNT(*) AS remaining FROM approvers
         WHERE document_request_id = ? AND status = 'Pending' AND id != ?`,
        [approver.document_request_id, req.params.id]
      );
      if (remaining === 0) {
        await conn.query(
          "UPDATE document_requests SET status = 'Approved' WHERE id = ?",
          [approver.document_request_id]
        );
      }
    }

    await conn.commit();
    res.json({ message: `Request ${action.toLowerCase()} successfully` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to process action' });
  } finally {
    conn.release();
  }
});

// GET /api/requests/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const [[request]] = await db.query(
      'SELECT pdf_filename, pdf_original_name FROM document_requests WHERE id = ?',
      [req.params.id]
    );
    if (!request || !request.pdf_filename) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    const filePath = path.join(uploadDir, request.pdf_filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });

    res.setHeader('Content-Disposition', `inline; filename="${request.pdf_original_name}"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to serve PDF' });
  }
});

module.exports = router;
