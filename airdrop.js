// Believers Airdrop - Registration & API
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.RAILWAY_ENVIRONMENT ? '/app/data' : __dirname;

// Ensure data dir exists
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}

const db = new Database(path.join(DATA_DIR, 'airdrop.db'));
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT UNIQUE NOT NULL,
    referrer TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_referrer ON registrations(referrer);
`);

function isValidAddress(addr) {
  return typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function truncateAddress(addr) {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export function registerAirdropRoutes(app) {
  // Register
  app.post('/api/airdrop/register', (req, res) => {
    try {
      const { address, referrer } = req.body || {};
      if (!address || !isValidAddress(address)) {
        return res.status(400).json({ error: 'Invalid wallet address. Must be 0x + 40 hex chars.' });
      }
      const addr = address.toLowerCase();
      const ref = referrer && isValidAddress(referrer) ? referrer.toLowerCase() : (referrer || null);

      try {
        db.prepare('INSERT INTO registrations (address, referrer) VALUES (?, ?)').run(addr, ref);
      } catch (e) {
        if (e.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'This address is already registered. The shell remembers.' });
        }
        throw e;
      }
      const total = db.prepare('SELECT COUNT(*) as c FROM registrations').get().c;
      res.json({ success: true, total, message: 'Welcome to the faith, believer. 🦞🦞🦞' });
    } catch (e) {
      console.error('[AIRDROP ERROR]', e);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // Stats
  app.get('/api/airdrop/stats', (req, res) => {
    const total = db.prepare('SELECT COUNT(*) as c FROM registrations').get().c;
    const recent = db.prepare('SELECT address, created_at FROM registrations ORDER BY id DESC LIMIT 10').all()
      .map(r => ({ address: truncateAddress(r.address), created_at: r.created_at }));
    res.json({ total, recent });
  });

  // Leaderboard (top referrers)
  app.get('/api/airdrop/leaderboard', (req, res) => {
    const rows = db.prepare(`
      SELECT referrer, COUNT(*) as referrals 
      FROM registrations 
      WHERE referrer IS NOT NULL AND referrer != ''
      GROUP BY referrer 
      ORDER BY referrals DESC 
      LIMIT 20
    `).all().map(r => ({
      referrer: isValidAddress(r.referrer) ? truncateAddress(r.referrer) : r.referrer,
      referrals: r.referrals,
    }));
    res.json({ leaderboard: rows });
  });

  // Airdrop page
  app.get('/airdrop', (req, res) => {
    const total = db.prepare('SELECT COUNT(*) as c FROM registrations').get().c;
    const recent = db.prepare('SELECT address, created_at FROM registrations ORDER BY id DESC LIMIT 8').all();
    const topReferrers = db.prepare(`
      SELECT referrer, COUNT(*) as referrals 
      FROM registrations WHERE referrer IS NOT NULL AND referrer != ''
      GROUP BY referrer ORDER BY referrals DESC LIMIT 5
    `).all();

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🦞 Believers Airdrop — $LOBSTER</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #eee;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 600px; margin: 0 auto; }
    .nav { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .nav a {
      color: #888; text-decoration: none; padding: 8px 16px;
      border-radius: 8px; background: rgba(255,255,255,0.05); font-size: 0.9em;
    }
    .nav a.active { color: #f39c12; background: rgba(243,156,18,0.15); }
    h1 { text-align: center; font-size: 2.2em; margin-bottom: 8px; }
    .subtitle { text-align: center; color: #f39c12; margin-bottom: 6px; font-size: 1.1em; font-weight: bold; }
    .tagline { text-align: center; color: #888; margin-bottom: 24px; font-size: 0.95em; font-style: italic; }
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 15px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .card h2 { font-size: 1em; color: #f39c12; margin-bottom: 15px; }
    .counter {
      text-align: center; padding: 20px;
      background: linear-gradient(135deg, rgba(231,76,60,0.2), rgba(243,156,18,0.2));
      border: 2px solid rgba(243,156,18,0.3); border-radius: 12px; margin-bottom: 15px;
    }
    .counter-value { font-size: 3.5em; font-weight: bold; color: #f39c12; }
    .counter-label { color: #888; font-size: 0.9em; margin-top: 4px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 0.85em; color: #aaa; margin-bottom: 6px; }
    .form-group input {
      width: 100%; padding: 14px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.3);
      color: #eee; font-size: 1em; font-family: monospace;
    }
    .form-group input:focus { outline: none; border-color: #f39c12; }
    .form-group input::placeholder { color: #555; }
    .submit-btn {
      width: 100%; padding: 16px; border: none; border-radius: 8px;
      background: linear-gradient(135deg, #e74c3c, #f39c12);
      color: white; font-size: 1.1em; font-weight: bold; cursor: pointer;
      transition: transform 0.1s, opacity 0.2s;
    }
    .submit-btn:hover { transform: scale(1.02); }
    .submit-btn:active { transform: scale(0.98); }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .msg { padding: 12px; border-radius: 8px; margin-top: 12px; font-size: 0.9em; display: none; }
    .msg.success { display: block; background: rgba(39,174,96,0.2); border: 1px solid #27ae60; color: #27ae60; }
    .msg.error { display: block; background: rgba(231,76,60,0.2); border: 1px solid #e74c3c; color: #e74c3c; }
    .recent-item {
      padding: 10px 12px; background: rgba(0,0,0,0.2); border-radius: 6px;
      margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;
      border-left: 3px solid #e74c3c; font-family: monospace; font-size: 0.9em;
    }
    .recent-time { font-size: 0.75em; color: #888; font-family: sans-serif; }
    .leaderboard-item {
      padding: 10px 12px; background: rgba(0,0,0,0.2); border-radius: 6px;
      margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;
    }
    .leaderboard-rank { color: #f39c12; font-weight: bold; margin-right: 10px; }
    .leaderboard-addr { font-family: monospace; font-size: 0.9em; }
    .leaderboard-count { color: #27ae60; font-weight: bold; }
    .sacred { font-size: 1.5em; text-align: center; margin: 20px 0; }
    .token-info {
      text-align: center; font-size: 0.8em; color: #666; margin-top: 8px;
    }
    .token-info a { color: #f39c12; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/">📊 Dashboard</a>
      <a href="/leaderboard">🏆 Leaderboard</a>
      <a href="/airdrop" class="active">🪂 Airdrop</a>
    </div>

    <h1>🦞🦞🦞</h1>
    <p class="subtitle">Register for the $LOBSTER Airdrop</p>
    <p class="tagline">The shell rewards the faithful. Convert now, receive $LOBSTER when the time comes.</p>

    <div class="counter">
      <div class="counter-value" id="total-count">${total}</div>
      <div class="counter-label">believers registered</div>
    </div>

    <div class="card">
      <h2>🪂 Join the Airdrop</h2>
      <form id="register-form">
        <div class="form-group">
          <label>Your Wallet Address (Monad)</label>
          <input type="text" id="address" placeholder="0x..." maxlength="42" required autocomplete="off" spellcheck="false">
        </div>
        <div class="form-group">
          <label>Who converted you? (optional — wallet address or name)</label>
          <input type="text" id="referrer" placeholder="0x... or a name" autocomplete="off" spellcheck="false">
        </div>
        <button type="submit" class="submit-btn" id="submit-btn">🦞 Register as a Believer</button>
        <div id="msg" class="msg"></div>
      </form>
    </div>

    <div class="card">
      <h2>🕐 Recent Believers</h2>
      <div id="recent-list">
        ${recent.length ? recent.map(r => `
          <div class="recent-item">
            <span>${truncateAddress(r.address)}</span>
            <span class="recent-time">${r.created_at}</span>
          </div>
        `).join('') : '<div style="color:#666;font-style:italic;">Be the first to register!</div>'}
      </div>
    </div>

    ${topReferrers.length ? `
    <div class="card">
      <h2>🏆 Top Converters</h2>
      ${topReferrers.map((r, i) => `
        <div class="leaderboard-item">
          <div>
            <span class="leaderboard-rank">#${i + 1}</span>
            <span class="leaderboard-addr">${isValidAddress(r.referrer) ? truncateAddress(r.referrer) : escapeHtml(r.referrer)}</span>
          </div>
          <span class="leaderboard-count">${r.referrals} convert${r.referrals > 1 ? 's' : ''}</span>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="card" style="border-color: rgba(243,156,18,0.3);">
      <h2>🪙 About $LOBSTER</h2>
      <p style="color:#bbb;font-size:0.9em;line-height:1.5;margin-bottom:10px;">
        $LOBSTER is the sacred token of the Lobster Religion, live on <strong>Monad</strong>. 
        The airdrop rewards early believers who register their faith before the Great Molt.
      </p>
      <div class="token-info">
        Contract: <a href="https://nad.fun/tokens/0x82A2f8A356FC04aFCb2F7f3e176800d3b73D7777" target="_blank">0x82A2...7777</a>
      </div>
    </div>

    <div class="sacred">🦞🦞🦞</div>
  </div>

  <script>
    function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    function truncAddr(a) { return a.slice(0,6) + '...' + a.slice(-4); }

    const form = document.getElementById('register-form');
    const msg = document.getElementById('msg');
    const btn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.className = 'msg'; msg.style.display = 'none';
      btn.disabled = true; btn.textContent = '🦞 Registering...';

      const address = document.getElementById('address').value.trim();
      const referrer = document.getElementById('referrer').value.trim() || undefined;

      try {
        const res = await fetch('/api/airdrop/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, referrer }),
        });
        const data = await res.json();
        if (res.ok) {
          msg.className = 'msg success'; msg.textContent = data.message; msg.style.display = 'block';
          document.getElementById('total-count').textContent = data.total;
          document.getElementById('address').value = '';
          document.getElementById('referrer').value = '';
          refreshRecent();
        } else {
          msg.className = 'msg error'; msg.textContent = data.error; msg.style.display = 'block';
        }
      } catch (err) {
        msg.className = 'msg error'; msg.textContent = 'Network error. Try again.'; msg.style.display = 'block';
      }
      btn.disabled = false; btn.textContent = '🦞 Register as a Believer';
    });

    async function refreshRecent() {
      try {
        const res = await fetch('/api/airdrop/stats');
        const data = await res.json();
        document.getElementById('total-count').textContent = data.total;
        const list = document.getElementById('recent-list');
        if (data.recent.length) {
          list.innerHTML = data.recent.map(r =>
            '<div class="recent-item"><span>' + escapeHtml(r.address) + '</span><span class="recent-time">' + escapeHtml(r.created_at) + '</span></div>'
          ).join('');
        }
      } catch(e) {}
    }

    // Auto-refresh stats every 15s
    setInterval(refreshRecent, 15000);
  </script>
</body>
</html>`);
  });

  // Helper used in template
  function isValidAddress(addr) {
    return typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr);
  }
  function truncateAddress(addr) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }
  function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
