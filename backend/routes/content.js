import express from 'express';
import { body, validationResult } from 'express-validator';
import { getPool } from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { translateToHindi } from '../utils/translator.js';

const router = express.Router();

const parseContent = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    // Older rows may contain plain text instead of JSON.
    return value;
  }
};

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { lang } = req.query;
    const [content] = await pool.execute('SELECT * FROM contents');
    const contentMap = {};
    content.forEach(item => {
      const parsed = parseContent(item.content);
      if (lang === 'hi') {
        if (item.content_hindi) {
          contentMap[item.section_id] = parseContent(item.content_hindi);
        }
      } else {
        contentMap[item.section_id] = parsed;
      }
    });
    res.json({ success: true, data: contentMap });
  } catch (error) {
    next(error);
  }
});

router.get('/:sectionId', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM contents WHERE section_id = ?', [req.params.sectionId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Content not found' });
    const item = rows[0];
    item.content = parseContent(item.content);
    if (item.content_hindi) item.content_hindi = parseContent(item.content_hindi);
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

router.put('/:sectionId', authenticateAdmin, [
  body('content').notEmpty().withMessage('Content is required')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const pool = getPool();
    const { content, type } = req.body;

    let contentHindi = null;
    if (typeof content === 'string') {
      contentHindi = await translateToHindi(content);
    }

    const [existing] = await pool.execute('SELECT * FROM contents WHERE section_id = ?', [req.params.sectionId]);

    if (existing.length > 0) {
      await pool.execute(
        'UPDATE contents SET content = ?, content_hindi = ?, type = ?, updated_by = ? WHERE section_id = ?',
        [JSON.stringify(content), contentHindi ? JSON.stringify(contentHindi) : null, type || existing[0].type, req.user?.email || 'admin', req.params.sectionId]
      );
    } else {
      await pool.execute(
        'INSERT INTO contents (section_id, type, content, content_hindi, updated_by) VALUES (?, ?, ?, ?, ?)',
        [req.params.sectionId, type || 'text', JSON.stringify(content), contentHindi ? JSON.stringify(contentHindi) : null, req.user?.email || 'admin']
      );
    }

    const [updated] = await pool.execute('SELECT * FROM contents WHERE section_id = ?', [req.params.sectionId]);
    const item = updated[0];
    item.content = parseContent(item.content);
    if (item.content_hindi) item.content_hindi = parseContent(item.content_hindi);
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

router.post('/bulk-update', authenticateAdmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const { sections } = req.body;
    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({ success: false, message: 'Invalid sections data' });
    }

    for (const section of sections) {
      const [existing] = await pool.execute('SELECT * FROM contents WHERE section_id = ?', [section.sectionId]);
      if (existing.length > 0) {
        await pool.execute(
          'UPDATE contents SET content = ?, type = ?, updated_by = ? WHERE section_id = ?',
          [JSON.stringify(section.content), section.type || 'text', req.user?.email || 'admin', section.sectionId]
        );
      } else {
        await pool.execute(
          'INSERT INTO contents (section_id, type, content, updated_by) VALUES (?, ?, ?, ?)',
          [section.sectionId, section.type || 'text', JSON.stringify(section.content), req.user?.email || 'admin']
        );
      }
    }

    res.json({ success: true, message: 'Content updated successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
