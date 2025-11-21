// server.js
// Chạy: npm init -y && npm install express cookie-parser
// Rồi: node server.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'messages.json');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Đọc dữ liệu lời nhắn
function readMessages() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

// Ghi dữ liệu lời nhắn
function writeMessages(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Tạo ID đơn giản
function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// Helper: escape HTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

// Trang chủ
app.get('/', (req, res) => {
  const messages = readMessages().sort((a, b) => b.createdAt - a.createdAt);

  const listItems = messages.map(m => {
    const target = `/message/${m.id}`;
    const link = `/go?to=${encodeURIComponent(target)}`;
    return `
      <li class="card">
        <div class="card-header">
          <span class="avatar">${(m.name || 'SV').slice(0,1).toUpperCase()}</span>
          <div>
            <strong>${escapeHtml(m.name || 'Sinh viên')}</strong>
            <div class="time">${new Date(m.createdAt).toLocaleString()}</div>
          </div>
        </div>
        <p class="content">${escapeHtml(m.content)}</p>
        <a class="btn-outline" href="${link}">Xem lời nhắn</a>
      </li>
    `;
  }).join('');

  const submitLink = `/go?to=${encodeURIComponent('/submit')}`;

  res.send(`
    <!doctype html>
    <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Bảng lời nhắn sinh viên</title>
      <link rel="stylesheet" href="/public/style.css" />
    </head>
    <body>
      <header class="hero">
        <h1>Sinh viên có điều muốn nói?</h1>
        <p>Chia sẻ thông điệp của bạn để toàn trường cùng thấy.</p>
        <p>Lưu ý: Do đây là phiên bản thử nghiệm nên các tin nhắn sẽ tự động xóa sau vài ngày!</p>
        <a class="btn" href="${submitLink}">Gửi lời nhắn ngay</a>
      </header>

      <main class="container">
        <h2>Lời nhắn mới nhất</h2>
        <ul class="grid">
          ${listItems || '<p>Chưa có lời nhắn nào. Hãy là người đầu tiên!</p>'}
        </ul>
      </main>

      <footer class="footer">
        <small>© ${new Date().getFullYear()} — Cộng đồng sinh viên EIU</small>
      </footer>
    </body>
    </html>
  `);
});

// Trang gửi bài
app.get('/submit', (req, res) => {
  res.send(`
    <!doctype html>
    <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Gửi lời nhắn</title>
      <link rel="stylesheet" href="/public/style.css" />
    </head>
    <body>
      <header class="hero">
        <h1>Gửi lời nhắn</h1>
        <p>Xin hãy gửi tin nhắn lịch sự, không dùng từ ngữ xúc phạm.</p>
      </header>
      <main class="container">
        <form class="form" method="POST" action="/submit">
          <label>
            <span>Nickname</span>
            <input name="name" type="text" maxlength="50" required />
          </label>
          <label>
            <span>Nội dung lời nhắn</span>
            <textarea name="content" rows="6" maxlength="500" required></textarea>
          </label>
          <div class="actions">
            <button class="btn" type="submit">Đăng lời nhắn</button>
            <a class="btn-outline" href="/">Về trang chủ</a>
          </div>
        </form>
      </main>
    </body>
    </html>
  `);
});

// Xử lý gửi bài
app.post('/submit', (req, res) => {
  const name = (req.body.name || '').trim();
  const content = (req.body.content || '').trim();

  if (!name || !content) {
    return res.status(400).send('Thiếu tên hoặc nội dung.');
  }
  if (content.length > 500) {
    return res.status(400).send('Nội dung quá dài (tối đa 500 ký tự).');
  }

  const messages = readMessages();
  const id = makeId();
  const message = { 
    id, 
    name, 
    content, 
    createdAt: Date.now(),
    reactions: { heart: 0, like: 0, angry: 0, sad: 0, wow: 0 },
    comments: []
  };
  messages.push(message);
  writeMessages(messages);

  res.redirect(`/message/${id}`);
});

// Thả cảm xúc
app.post('/react/:id', (req, res) => {
  const { id } = req.params;
  const { type } = req.body;

  const messages = readMessages();
  const m = messages.find(x => x.id === id);
  if (!m) return res.status(404).send('Không tìm thấy lời nhắn.');

  if (!m.reactions) {
    m.reactions = { heart: 0, like: 0, angry: 0, sad: 0, wow: 0 };
  }
  m.reactions[type] = (m.reactions[type] || 0) + 1;

  writeMessages(messages);
  res.redirect(`/message/${id}`);
});

// Bình luận
app.post('/comment/:id', (req, res) => {
  const { id } = req.params;
  const { name, content } = req.body;

  const messages = readMessages();
  const m = messages.find(x => x.id === id);
  if (!m) return res.status(404).send('Không tìm thấy lời nhắn.');

  if (!m.comments) m.comments = [];
  m.comments.push({ name, content, createdAt: Date.now() });

  writeMessages(messages);
  res.redirect(`/message/${id}`);
});

// Trang xem một lời nhắn
app.get('/message/:id', (req, res) => {
  const messages = readMessages();
  const m = messages.find(x => x.id === req.params.id);
  if (!m) return res.status(404).send('Không tìm thấy lời nhắn.');

  res.send(`
    <!doctype html>
    <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Lời nhắn của ${escapeHtml(m.name)}</title>
      <link rel="stylesheet" href="/public/style.css" />
    </head>
    <body>
      <header class="hero small">
        <h1>Lời nhắn</h1>
        <p>Từ: <strong>${escapeHtml(m.name)}</strong> • ${new Date(m.createdAt).toLocaleString()}</p>
      </header>
      <main class="container">
        <article class="card">
          <p class="content">${escapeHtml(m.content)}</p>

          <!-- Cảm xúc -->
          <form method="POST" action="/react/${m.id}">
            <button name="type" value="heart">❤️ ${m.reactions?.heart || 0}</button>
            <button name="type" value="like">👍 ${m.reactions?.like || 0}</button>
            <button name="type" value="angry">😡 ${m.reactions?.angry || 0}</button>
            <button name="type" value="sad">😢 ${m.reactions?.sad || 0}</button>
            <button name="type" value="wow">😮 ${m.reactions?.wow || 0}</button>
          </form>

          <!-- Bình luận -->
          <section class="comments">
            <h3>Bình luận (${m.comments?.length || 0})</h3>
            <ul>
              ${m.comments && m.comments.length > 0 ? m.comments.map(c => `
                <li>
                  <strong>${escapeHtml(c.name)}</strong> <em>• ${new Date(c.createdAt).toLocaleString()}</em>
                  <p>${escapeHtml(c.content)}</p>
                </li>
              `).join('') : '<li>Chưa có bình luận nào.</li>'}
            </ul>

            <form method="POST" action="/comment/${m.id}">
              <label>
                <span>Họ tên</span>
                <input name="name" type="text" maxlength="50" required />
              </label>
              <label>
                <span>Nội dung bình luận</span>
                <textarea name="content" rows="1" maxlength="300" required></textarea>
              </label>
              <button class="btn" type="submit">Gửi bình luận</button>
            </form>
          </section>
        </article>

        <a class="btn-outline" href="/">Về trang chủ</a>
      </main>
    </body>
    </html>
  `);
});

// Route chuyển hướng an toàn
app.get('/go', (req, res) => {
  const to = req.query.to || '/';
  res.redirect(to);
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
