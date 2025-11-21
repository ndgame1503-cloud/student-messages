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

// Trang chủ: danh sách lời nhắn
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
        <a class="btn" href="${submitLink}">Gửi lời nhắn ngay</a>
      </header>

      <main class="container">
        <h2>Lời nhắn mới nhất</h2>
        <ul class="grid">
          ${listItems || '<p>Chưa có lời nhắn nào. Hãy là người đầu tiên!</p>'}
        </ul>
      </main>

      <footer class="footer">
        <small>© ${new Date().getFullYear()} — Cộng đồng sinh viên</small>
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
        <p>Viết ngắn gọn, lịch sự và truyền cảm hứng.</p>
      </header>
      <main class="container">
        <form class="form" method="POST" action="/submit">
          <label>
            <span>Họ tên/Nickname</span>
            <input name="name" type="text" maxlength="50" placeholder="VD: Minh, Linh, v.v." required />
          </label>
          <label>
            <span>Nội dung lời nhắn</span>
            <textarea name="content" rows="6" maxlength="500" placeholder="Điều bạn muốn chia sẻ..." required></textarea>
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
  const message = { id, name, content, createdAt: Date.now() };
  messages.push(message);
  writeMessages(messages);

  res.redirect(`/message/${id}`);
});

// Trang xem một lời nhắn
app.get('/message/:id', (req, res) => {
  const messages = readMessages();
  const m = messages.find(x => x.id === req.params.id);
  if (!m) return res.status(404).send('Không tìm thấy lời nhắn.');

  const shareLink = `${req.protocol}://${req.get('host')}/go?to=${encodeURIComponent('/message/' + m.id)}`;

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
          <div class="actions">
            <a class="btn" href="/">Về trang chủ</a>
            <a class="btn-outline" href="/go?to=${encodeURIComponent('/submit')}">Gửi lời nhắn của bạn</a>
          </div>
        </article>
        <section class="share">
          <h3>Link chia sẻ (lần đầu sẽ dẫn đến quảng cáo)</h3>
          <code>${shareLink}</code>
        </section>
      </main>
    </body>
    </html>
  `);
});

// Trang quảng cáo/interstitial (lần đầu click)
app.get('/go', (req, res) => {
  const to = req.query.to;
  if (!to || typeof to !== 'string') {
    return res.status(400).send('Thiếu tham số "to".');
  }

  const cookieKey = `visited_${Buffer.from(to).toString('base64')}`;
  const visited = req.cookies[cookieKey] === '1';

  // Nếu đã từng click link này → vào thẳng trang đích
  //if (visited) {
    return res.redirect(to);
  //}

  // Chưa từng click → hiển thị quảng cáo, lần này thiết lập cookie
  res.send(`
    <!doctype html>
    <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Quảng cáo</title>
      <link rel="stylesheet" href="/public/style.css" />
      <meta http-equiv="Cache-Control" content="no-store" />
    </head>
    <body>
      <header class="hero small">
        <h1>Hỗ trợ trang bằng quảng cáo</h1>
        <p>Lần đầu bạn nhấp link sẽ hiển thị quảng cáo. Lần tiếp theo sẽ vào trang đích.</p>
      </header>
      <main class="container">
        <div class="ad-box">
          <!-- Placeholder cho AdSense hoặc banner nội bộ -->
          <div class="fake-ad">Quảng cáo đang hiển thị</div>
          <!-- Chèn script quảng cáo của bạn ở đây -->
        </div>
        <div class="actions">
          <form method="POST" action="/go/continue">
            <input type="hidden" name="to" value="${escapeAttr(to)}" />
            <button class="btn" type="submit">Tiếp tục vào trang</button>
          </form>
          <a class="btn-outline" href="/">Về trang chủ</a>
        </div>
      </main>
    </body>
    </html>
  `);
});

// Xác nhận đã xem quảng cáo và chuyển hướng (đặt cookie)
app.post('/go/continue', (req, res) => {
  const toChunks = [];
  req.on('data', chunk => toChunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(toChunks).toString('utf8');
    const params = new URLSearchParams(body);
    const to = params.get('to') || '/';

    const cookieKey = `visited_${Buffer.from(to).toString('base64')}`;
    res.cookie(cookieKey, '1', {
      httpOnly: false,
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 ngày
    });
    res.redirect(to);
  });
});

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

app.listen(PORT, () => {
  // Khởi tạo file dữ liệu nếu chưa có
  if (!fs.existsSync(DATA_FILE)) writeMessages([]);
  console.log(`Server chạy tại http://localhost:${PORT}`);
});
