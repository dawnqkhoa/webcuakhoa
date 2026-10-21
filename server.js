
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const MOODS_FILE = path.join(DATA_DIR, 'moods.json');
const CUSTOM_MOODS_FILE = path.join(DATA_DIR, 'custom-moods.json');
const LETTERS_FILE = path.join(DATA_DIR, 'letters.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  '';

const sharedStoreReady = Boolean(SUPABASE_URL && SUPABASE_KEY);

fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function cleanText(value, max) {
  return String(value || '').trim().slice(0, max);
}

function publicLetter(letter) {
  return {
    id: letter.id,
    sender: letter.sender,
    subject: letter.subject,
    createdAt: letter.createdAt || letter.created_at
  };
}

function supabaseHeaders(extra = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extra
  };

  // Chỉ dùng Bearer cho service-role key dạng JWT cũ.
  if (SUPABASE_KEY.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  }

  return headers;
}

async function supabaseRequest(table, options = {}) {
  const {
    method = 'GET',
    query = '',
    body
  } = options;

  const url =
    `${SUPABASE_URL}/rest/v1/${table}` +
    (query ? `?${query}` : '');

  const response = await fetch(url, {
    method,
    headers: supabaseHeaders(),
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) })
  });

  const raw = await response.text();
  let data = [];

  try {
    data = raw ? JSON.parse(raw) : [];
  } catch {
    data = [];
  }

  if (!response.ok) {
    const error = new Error(
      data.message ||
      data.error ||
      `Supabase lỗi (${response.status})`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

function sendStoreError(res, error) {
  console.error(
    'Storage error:',
    error.message,
    error.status ? `(HTTP ${error.status})` : ''
  );

  res.status(500).json({
    error: sharedStoreReady
      ? 'Chưa lưu được lúc này. Hãy thử tải lại trang sau một chút nhé.'
      : 'Kho lưu chung chưa được kết nối. Hãy thử lại sau nhé.'
  });
}

app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.use(express.static(PUBLIC_DIR));

app.get('/api/config', (_req, res) => {
  res.json({ sharedStoreReady });
});

// -------------------- CẢM XÚC --------------------

const moodLevels = {
  'bực mình': [
    'Hơi hơi bực',
    'Hơi khó chịu',
    'Bực khá nhiều',
    'Rất rất bực',
    'Sắp nổ tung'
  ],
  'muốn ôm': [
    'Ôm nhẹ một cái',
    'Muốn ôm một chút',
    'Cần một cái ôm lâu',
    'Cần ôm ngay',
    'Ôm ngay đi mà'
  ],
  'nhớ cậu': [
    'Nhớ một chút',
    'Hơi nhớ rồi',
    'Nhớ kha khá',
    'Nhớ nhiều lắm',
    'Nhớ cậu muốn xỉu'
  ]
};

app.get('/api/custom-moods', async (_req, res) => {
  try {
    if (sharedStoreReady) {
      const moods = await supabaseRequest('custom_moods', {
        query:
          'select=id,name,emoji,createdAt:created_at' +
          '&order=created_at.asc&limit=100'
      });

      return res.json({ moods, shared: true });
    }

    return res.json({
      moods: readJson(CUSTOM_MOODS_FILE, []),
      shared: false
    });
  } catch (error) {
    sendStoreError(res, error);
  }
});

app.post('/api/custom-moods', async (req, res) => {
  const name = cleanText(req.body?.name, 32);
  const emoji = cleanText(req.body?.emoji, 8) || '♡';

  if (!name) {
    return res.status(400).json({
      error: 'Hãy đặt tên cho cảm xúc nhé.'
    });
  }

  if (['bực mình', 'muốn ôm', 'nhớ cậu'].includes(name.toLowerCase())) {
    return res.status(400).json({
      error: 'Cảm xúc này đã có sẵn rồi.'
    });
  }

  try {
    if (sharedStoreReady) {
      const existing = await supabaseRequest('custom_moods', {
        query:
          `select=id,name&name=ilike.${encodeURIComponent(name)}&limit=1`
      });

      if (existing.length) {
        return res.status(409).json({
          error: 'Cảm xúc này đã được thêm rồi.'
        });
      }

      const rows = await supabaseRequest('custom_moods', {
        method: 'POST',
        body: { name, emoji }
      });

      return res.json({
        ok: true,
        mood: rows[0] || { name, emoji },
        shared: true
      });
    }

    const all = readJson(CUSTOM_MOODS_FILE, []);

    if (all.some(item => item.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({
        error: 'Cảm xúc này đã được thêm rồi.'
      });
    }

    const mood = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      emoji,
      createdAt: new Date().toISOString()
    };

    all.push(mood);
    writeJson(CUSTOM_MOODS_FILE, all.slice(-100));

    return res.json({ ok: true, mood, shared: false });
  } catch (error) {
    sendStoreError(res, error);
  }
});

app.post('/api/mood', async (req, res) => {
  const mood = cleanText(req.body?.mood, 40);

  if (!mood) {
    return res.status(400).json({
      error: 'Hãy chọn một cảm xúc nhé.'
    });
  }

  const level = Math.min(
    5,
    Math.max(1, Number.parseInt(req.body?.level, 10) || 1)
  );

  const intensity =
    (moodLevels[mood] || [])[level - 1] ||
    'Một cảm xúc riêng của cậu';

  const emoji = cleanText(req.body?.emoji, 8) || '';

  const event = {
    mood,
    emoji,
    level,
    intensity,
    createdAt: new Date().toISOString()
  };

  try {
    if (sharedStoreReady) {
      await supabaseRequest('moods', {
        method: 'POST',
        body: { mood, emoji, level, intensity }
      });
    } else {
      const all = readJson(MOODS_FILE, []);
      all.push(event);
      writeJson(MOODS_FILE, all.slice(-500));
    }

    res.json({
      ok: true,
      shared: sharedStoreReady,
      event
    });
  } catch (error) {
    sendStoreError(res, error);
  }
});

app.get('/api/moods', async (_req, res) => {
  try {
    if (sharedStoreReady) {
      const moods = await supabaseRequest('moods', {
        query:
          'select=id,mood,emoji,level,intensity,createdAt:created_at' +
          '&order=created_at.desc&limit=200'
      });

      return res.json({ moods, shared: true });
    }

    return res.json({
      moods: readJson(MOODS_FILE, []).slice().reverse(),
      shared: false
    });
  } catch (error) {
    sendStoreError(res, error);
  }
});

// -------------------- NOTE VÀ ẢNH --------------------

async function uploadNoteImage(dataUrl) {
  if (!dataUrl) return '';

  const match = String(dataUrl).match(
    /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/
  );

  if (!match) {
    throw new Error('Ảnh chỉ hỗ trợ PNG, JPG, WEBP hoặc GIF.');
  }

  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.length > 3 * 1024 * 1024) {
    throw new Error('Mỗi ảnh tối đa 3 MB nhé.');
  }

  // Khi chưa kết nối Supabase, giữ ảnh dạng data URL trong JSON.
  if (!sharedStoreReady) return dataUrl;

  const ext = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
  }[match[1]];

  const filename =
    `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/note-images/${filename}`,
    {
      method: 'POST',
      headers: supabaseHeaders({
        'Content-Type': match[1],
        'x-upsert': 'false'
      }),
      body: buffer
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Không tải được ảnh lên Supabase (${response.status}): ` +
      detail.slice(0, 180)
    );
  }

  return (
    `${SUPABASE_URL}/storage/v1/object/public/` +
    `note-images/${filename}`
  );
}

app.get('/api/notes', async (_req, res) => {
  try {
    if (sharedStoreReady) {
      const notes = await supabaseRequest('notes', {
        query:
          'select=id,text,author,image_url,createdAt:created_at' +
          '&order=created_at.desc&limit=200'
      });

      return res.json({
        notes: notes.slice().reverse(),
        shared: true
      });
    }

    const notes = readJson(NOTES_FILE, []).slice(-200).map(
      ({ password_hash, delete_password_hash, ...note }) => note
    );

    return res.json({ notes, shared: false });
  } catch (error) {
    sendStoreError(res, error);
  }
});

app.post('/api/notes', async (req, res) => {
  const text = cleanText(req.body?.text, 280);
  const author = cleanText(req.body?.author, 40);
  const password = String(req.body?.deletePassword || '');
  const imageData = String(req.body?.imageData || '');

  if (!text && !imageData) {
    return res.status(400).json({
      error: 'Hãy viết vài dòng hoặc chọn một tấm ảnh nhé.'
    });
  }

  if (!author) {
    return res.status(400).json({
      error: 'Hãy nhập tên hoặc biệt danh.'
    });
  }

  if (password.length < 4) {
    return res.status(400).json({
      error: 'Mật khẩu xóa note cần ít nhất 4 ký tự.'
    });
  }

  if (imageData.length > 4.5 * 1024 * 1024) {
    return res.status(413).json({
      error: 'Ảnh hơi lớn, hãy chọn ảnh tối đa 3 MB nhé.'
    });
  }

  const record = {
    text,
    author,
    password_hash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString()
  };

  try {
    record.image_url = await uploadNoteImage(imageData);

    if (sharedStoreReady) {
      await supabaseRequest('notes', {
        method: 'POST',
        body: {
          text: text || '',
          author,
          image_url: record.image_url,
          delete_password_hash: record.password_hash
        }
      });

      const notes = await supabaseRequest('notes', {
        query:
          'select=id,text,author,image_url,createdAt:created_at' +
          '&order=created_at.desc&limit=200'
      });

      return res.json({
        ok: true,
        notes: notes.slice().reverse(),
        shared: true
      });
    }

    const all = readJson(NOTES_FILE, []);

    all.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      ...record
    });

    const saved = all.slice(-200);
    writeJson(NOTES_FILE, saved);

    res.json({
      ok: true,
      notes: saved.map(({ password_hash, ...note }) => note),
      shared: false
    });
  } catch (error) {
    sendStoreError(res, error);
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  const password = String(req.body?.password || '');

  try {
    if (sharedStoreReady) {
      const rows = await supabaseRequest('notes', {
        query:
          `select=id,delete_password_hash` +
          `&id=eq.${encodeURIComponent(req.params.id)}&limit=1`
      });

      if (!rows.length) {
        return res.status(404).json({
          error: 'Không tìm thấy note.'
        });
      }

      if (
        !rows[0].delete_password_hash ||
        !await bcrypt.compare(password, rows[0].delete_password_hash)
      ) {
        return res.status(403).json({
          error: 'Mật khẩu xóa note chưa đúng.'
        });
      }

      await supabaseRequest('notes', {
        method: 'DELETE',
        query: `id=eq.${encodeURIComponent(req.params.id)}`
      });

      return res.json({ ok: true });
    }

    const notes = readJson(NOTES_FILE, []);
    const note = notes.find(
      item => String(item.id) === String(req.params.id)
    );

    if (!note) {
      return res.status(404).json({
        error: 'Không tìm thấy note.'
      });
    }

    if (!await bcrypt.compare(password, note.password_hash)) {
      return res.status(403).json({
        error: 'Mật khẩu xóa note chưa đúng.'
      });
    }

    writeJson(
      NOTES_FILE,
      notes.filter(item => String(item.id) !== String(req.params.id))
    );

    res.json({ ok: true });
  } catch (error) {
    sendStoreError(res, error);
  }
});

// -------------------- THƯ CÓ MẬT KHẨU --------------------

app.get('/api/letters', async (_req, res) => {
  try {
    let letters;

    if (sharedStoreReady) {
      letters = await supabaseRequest('letters', {
        query:
          'select=id,sender,subject,createdAt:created_at' +
          '&order=created_at.desc&limit=200'
      });
    } else {
      letters = readJson(LETTERS_FILE, []).slice().reverse();
    }

    res.json({
      letters: letters.map(publicLetter),
      shared: sharedStoreReady
    });
  } catch (error) {
    sendStoreError(res, error);
  }
});

app.post('/api/letters', async (req, res) => {
  const sender = cleanText(req.body?.sender, 40);
  const subject = cleanText(req.body?.subject, 80);
  const body = String(req.body?.body || '').trim();
  const password = String(req.body?.password || '');

  if (!sender || !subject || !body) {
    return res.status(400).json({
      error: 'Hãy điền tên, tiêu đề và nội dung thư.'
    });
  }

  if (body.length > 10000) {
    return res.status(400).json({
      error: 'Nội dung thư tối đa 10.000 ký tự.'
    });
  }

  if (password.length < 4) {
    return res.status(400).json({
      error: 'Mật khẩu thư cần ít nhất 4 ký tự.'
    });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const createdAt = new Date().toISOString();

  try {
    if (sharedStoreReady) {
      await supabaseRequest('letters', {
        method: 'POST',
        body: { sender, subject, body, password_hash }
      });

      const letters = await supabaseRequest('letters', {
        query:
          'select=id,sender,subject,createdAt:created_at' +
          '&order=created_at.desc&limit=200'
      });

      return res.json({
        ok: true,
        letters: letters.map(publicLetter),
        shared: true
      });
    }

    const all = readJson(LETTERS_FILE, []);

    all.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      sender,
      subject,
      body,
      password_hash,
      createdAt
    });

    writeJson(LETTERS_FILE, all.slice(-200));

    res.json({
      ok: true,
      letters: all.slice(-200).reverse().map(publicLetter),
      shared: false
    });
  } catch (error) {
    sendStoreError(res, error);
  }
});

app.post('/api/letters/:id/open', async (req, res) => {
  const password = String(req.body?.password || '');

  try {
    let letter;

    if (sharedStoreReady) {
      const rows = await supabaseRequest('letters', {
        query:
          `select=id,sender,subject,body,password_hash,createdAt:created_at` +
          `&id=eq.${encodeURIComponent(req.params.id)}&limit=1`
      });

      letter = rows[0];
    } else {
      letter = readJson(LETTERS_FILE, []).find(
        item => String(item.id) === String(req.params.id)
      );
    }

    if (!letter) {
      return res.status(404).json({
        error: 'Không tìm thấy bức thư.'
      });
    }

    if (!await bcrypt.compare(password, letter.password_hash)) {
      return res.status(403).json({
        error: 'Mật khẩu chưa đúng, thử lại nhé.'
      });
    }

    res.json({
      ok: true,
      letter: {
        id: letter.id,
        sender: letter.sender,
        subject: letter.subject,
        body: letter.body,
        createdAt: letter.createdAt || letter.created_at
      }
    });
  } catch (error) {
    sendStoreError(res, error);
  }
});

app.delete('/api/letters/:id', async (req, res) => {
  const password = String(req.body?.password || '');

  try {
    let letter;

    if (sharedStoreReady) {
      const rows = await supabaseRequest('letters', {
        query:
          `select=id,password_hash` +
          `&id=eq.${encodeURIComponent(req.params.id)}&limit=1`
      });

      letter = rows[0];
    } else {
      letter = readJson(LETTERS_FILE, []).find(
        item => String(item.id) === String(req.params.id)
      );
    }

    if (!letter) {
      return res.status(404).json({
        error: 'Không tìm thấy bức thư.'
      });
    }

    if (!await bcrypt.compare(password, letter.password_hash)) {
      return res.status(403).json({
        error: 'Mật khẩu chưa đúng, không thể xóa thư.'
      });
    }

    if (sharedStoreReady) {
      await supabaseRequest('letters', {
        method: 'DELETE',
        query: `id=eq.${encodeURIComponent(req.params.id)}`
      });
    } else {
      writeJson(
        LETTERS_FILE,
        readJson(LETTERS_FILE, []).filter(
          item => String(item.id) !== String(req.params.id)
        )
      );
    }

    res.json({ ok: true });
  } catch (error) {
    sendStoreError(res, error);
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`khoaguihuong đang chạy tại http://localhost:${PORT}`);
});
