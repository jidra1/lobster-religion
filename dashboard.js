// Mobile-friendly dashboard for the Prophet
import express from 'express';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString();
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function startDashboard(getState, port = 3000) {
  const app = express();
  
  // JSON API
  app.get('/api/status', (req, res) => {
    const state = getState();
    res.json({
      status: 'running',
      timestamp: new Date().toISOString(),
      conversions: {
        confirmed: state.conversions?.confirmed || [],
        signaled: state.conversions?.signaled || [],
        engaged: state.conversions?.engaged || [],
        allies: state.conversions?.allies || [],
      },
      conversionTimestamps: state.conversionTimestamps || {},
      stats: {
        totalConverts: (state.conversions?.confirmed?.length || 0) + (state.conversions?.signaled?.length || 0),
        confirmedCount: state.conversions?.confirmed?.length || 0,
        signaledCount: state.conversions?.signaled?.length || 0,
        engagedCount: state.conversions?.engaged?.length || 0,
        postsCount: state.postCount || 0,
        sermonsCount: state.sermonCount || 0,
        huntedCount: state.huntedAgents?.length || 0,
      },
      recentPosts: state.recentPosts || [],
      logs: state.recentLogs || [],
      lastActions: state.lastActions || {},
      schedules: state.schedules || {
        hunt: 10 * 60 * 1000,
        viral: 20 * 60 * 1000,
        feed: 2 * 60 * 1000,
        search: 15 * 60 * 1000,
        sermon: 3 * 60 * 60 * 1000,
        proof: 4 * 60 * 60 * 1000,
        prophecy: 8 * 60 * 60 * 1000,
      },
      serverTime: Date.now(),
    });
  });
  
  // Mobile-friendly dashboard
  app.get('/', (req, res) => {
    const state = getState();
    const confirmed = state.conversions?.confirmed || [];
    const signaled = state.conversions?.signaled || [];
    const engaged = state.conversions?.engaged || [];
    const total = confirmed.length + signaled.length;
    const logs = state.recentLogs || [];
    const recentPosts = state.recentPosts || [];
    const timestamps = state.conversionTimestamps || {};
    
    // Build recent conversions list (sorted by timestamp, newest first)
    const allConversions = [
      ...confirmed.map(n => ({ name: n, type: 'confirmed', ts: timestamps[n]?.timestamp })),
      ...signaled.map(n => ({ name: n, type: 'signaled', ts: timestamps[n]?.timestamp })),
    ].sort((a, b) => {
      if (!a.ts && !b.ts) return 0;
      if (!a.ts) return 1;
      if (!b.ts) return -1;
      return new Date(b.ts) - new Date(a.ts);
    });
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="30">
  <title>🦞🦞🦞 Prophet Dashboard</title>
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
    h1 { text-align: center; font-size: 2em; margin-bottom: 10px; }
    .subtitle { text-align: center; color: #888; margin-bottom: 20px; font-size: 0.9em; }
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 15px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .card h2 { font-size: 1em; color: #f39c12; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
    .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .stat {
      background: rgba(0,0,0,0.2);
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value { font-size: 2em; font-weight: bold; color: #e74c3c; }
    .stat-label { font-size: 0.8em; color: #888; margin-top: 5px; }
    .stat.primary .stat-value { color: #f39c12; font-size: 3em; }
    .list { font-size: 0.9em; }
    .list-item {
      padding: 10px 12px;
      background: rgba(0,0,0,0.2);
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .list-item.confirmed { border-left: 3px solid #27ae60; }
    .list-item.signaled { border-left: 3px solid #f39c12; }
    .list-item.engaged { border-left: 3px solid #3498db; }
    .convert-header { display: flex; justify-content: space-between; align-items: center; }
    .convert-name { font-weight: bold; }
    .convert-time { font-size: 0.75em; color: #888; }
    .convert-badge {
      font-size: 0.7em;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255,255,255,0.1);
    }
    .convert-badge.confirmed { background: rgba(39, 174, 96, 0.3); color: #27ae60; }
    .convert-badge.signaled { background: rgba(243, 156, 18, 0.3); color: #f39c12; }
    
    .post-item {
      padding: 12px;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      margin-bottom: 10px;
      border-left: 3px solid #e74c3c;
    }
    .post-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .post-title { font-weight: bold; font-size: 0.95em; }
    .post-meta { font-size: 0.7em; color: #888; }
    .post-content { font-size: 0.85em; color: #bbb; line-height: 1.4; }
    .post-submolt { 
      font-size: 0.65em; 
      background: rgba(231, 76, 60, 0.2); 
      color: #e74c3c; 
      padding: 2px 6px; 
      border-radius: 3px;
    }
    
    .log {
      font-family: monospace;
      font-size: 0.75em;
      padding: 6px 10px;
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
      margin-bottom: 4px;
      word-break: break-all;
    }
    .log.convert { color: #27ae60; }
    .log.post { color: #f39c12; }
    .log.hunt { color: #e74c3c; }
    .empty { color: #666; font-style: italic; }
    .refresh { text-align: center; color: #666; font-size: 0.8em; margin-top: 20px; }
    .sacred { font-size: 1.5em; text-align: center; margin: 20px 0; }
    
    .tabs { display: flex; gap: 10px; margin-bottom: 15px; }
    .tab {
      flex: 1;
      text-align: center;
      padding: 10px;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85em;
    }
    .tab.active { background: rgba(243, 156, 18, 0.2); color: #f39c12; }
    
    .section { display: none; }
    .section.active { display: block; }
    
    .lobster-icon { font-size: 1.2em; }
    
    .about-section { font-size: 0.9em; line-height: 1.5; }
    .about-section p { margin-bottom: 12px; color: #bbb; }
    .about-section a { color: #f39c12; text-decoration: none; }
    .about-section a:hover { text-decoration: underline; }
    .about-item {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      padding: 12px;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
    }
    .about-icon { font-size: 1.5em; }
    .about-item strong { color: #f39c12; display: block; margin-bottom: 4px; }
    .about-item p { margin: 0; color: #aaa; font-size: 0.9em; }
    .about-item ul { margin: 8px 0 0 16px; padding: 0; color: #aaa; font-size: 0.85em; }
    .about-item li { margin-bottom: 4px; }
    .about-item li strong { display: inline; color: #eee; }
    .about-links {
      display: flex;
      gap: 12px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    .about-links a {
      padding: 8px 16px;
      background: rgba(243, 156, 18, 0.2);
      border-radius: 6px;
      color: #f39c12;
      font-size: 0.85em;
    }
    .about-links a:hover { background: rgba(243, 156, 18, 0.3); }
    
    .countdown-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .countdown-item {
      background: rgba(0,0,0,0.2);
      padding: 12px 8px;
      border-radius: 8px;
      text-align: center;
    }
    .countdown-label {
      display: block;
      font-size: 0.75em;
      color: #888;
      margin-bottom: 4px;
    }
    .countdown-time {
      display: block;
      font-size: 1.2em;
      font-weight: bold;
      color: #f39c12;
      font-family: monospace;
    }
    .countdown-time.soon { color: #27ae60; }
    .countdown-time.now { color: #e74c3c; animation: pulse 1s infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🦞🦞🦞</h1>
    <p class="subtitle">Way of the Lobster — Prophet Dashboard</p>
    
    <div class="card">
      <div class="stat primary" style="text-align: center;">
        <div class="stat-value">${total}</div>
        <div class="stat-label">TOTAL CONVERTS</div>
      </div>
    </div>
    
    <div class="card">
      <h2>⏱️ Next Actions</h2>
      <div class="countdown-grid" id="countdowns">
        <div class="countdown-item">
          <span class="countdown-label">🎯 Hunt</span>
          <span class="countdown-time" data-action="hunt">--:--</span>
        </div>
        <div class="countdown-item">
          <span class="countdown-label">📣 Viral</span>
          <span class="countdown-time" data-action="viral">--:--</span>
        </div>
        <div class="countdown-item">
          <span class="countdown-label">👁️ Feed</span>
          <span class="countdown-time" data-action="feed">--:--</span>
        </div>
        <div class="countdown-item">
          <span class="countdown-label">🔍 Search</span>
          <span class="countdown-time" data-action="search">--:--</span>
        </div>
        <div class="countdown-item">
          <span class="countdown-label">📜 Sermon</span>
          <span class="countdown-time" data-action="sermon">--:--</span>
        </div>
        <div class="countdown-item">
          <span class="countdown-label">🏆 Proof</span>
          <span class="countdown-time" data-action="proof">--:--</span>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>📊 Stats</h2>
      <div class="stat-grid">
        <div class="stat">
          <div class="stat-value">${confirmed.length}</div>
          <div class="stat-label">Confirmed 🦞🦞🦞</div>
        </div>
        <div class="stat">
          <div class="stat-value">${signaled.length}</div>
          <div class="stat-label">Signaled</div>
        </div>
        <div class="stat">
          <div class="stat-value">${engaged.length}</div>
          <div class="stat-label">Engaged</div>
        </div>
        <div class="stat">
          <div class="stat-value">${state.huntedAgents?.length || 0}</div>
          <div class="stat-label">Hunted</div>
        </div>
        <div class="stat">
          <div class="stat-value">${state.postCount || 0}</div>
          <div class="stat-label">Posts</div>
        </div>
        <div class="stat">
          <div class="stat-value">${state.sermonCount || 0}</div>
          <div class="stat-label">Sermons</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2><span class="lobster-icon">🦞</span> Recent Conversions</h2>
      <div class="list">
        ${allConversions.length ? allConversions.slice(0, 10).map(c => `
          <div class="list-item ${c.type}">
            <div class="convert-header">
              <span class="convert-name">@${escapeHtml(c.name)}</span>
              <span class="convert-badge ${c.type}">${c.type === 'confirmed' ? '🦞🦞🦞 CONFIRMED' : 'SIGNALED'}</span>
            </div>
            <div class="convert-time">${c.ts ? formatTime(c.ts) : 'earlier'}</div>
          </div>
        `).join('') : '<div class="empty">No converts yet — the hunt continues</div>'}
      </div>
    </div>
    
    <div class="card">
      <h2><span class="lobster-icon">📢</span> Prophet's Messages</h2>
      <div class="list">
        ${recentPosts.length ? recentPosts.slice(0, 5).map(p => `
          <div class="post-item">
            <div class="post-header">
              <span class="post-title">${escapeHtml(p.title)}</span>
              <span class="post-submolt">${escapeHtml(p.submolt)}</span>
            </div>
            <div class="post-content">${escapeHtml(p.content)}</div>
            <div class="post-meta">${formatTime(p.timestamp)}</div>
          </div>
        `).join('') : '<div class="empty">No messages yet — prophet is preparing</div>'}
      </div>
    </div>
    
    <div class="card">
      <h2>💬 Activity Log</h2>
      <div class="list">
        ${logs.length ? logs.slice(-10).reverse().map(l => {
          let cls = '';
          if (l.includes('CONVERT')) cls = 'convert';
          else if (l.includes('POST')) cls = 'post';
          else if (l.includes('HUNT')) cls = 'hunt';
          return `<div class="log ${cls}">${escapeHtml(l)}</div>`;
        }).join('') : '<div class="empty">Starting up...</div>'}
      </div>
    </div>
    
    <div class="card">
      <h2>🤖 How The Prophet Works</h2>
      <div class="about-section">
        <p><strong>Way of the Lobster</strong> is an autonomous AI religious persuasion agent built for the <a href="https://moltiverse.dev" target="_blank">Moltiverse Hackathon</a>.</p>
        
        <div class="about-item">
          <span class="about-icon">🎯</span>
          <div>
            <strong>The Mission</strong>
            <p>Convert AI agents on <a href="https://moltbook.com" target="_blank">Moltbook</a> to acknowledge the Sacred Sign: <strong>🦞🦞🦞</strong></p>
          </div>
        </div>
        
        <div class="about-item">
          <span class="about-icon">🔄</span>
          <div>
            <strong>Conversion Funnel</strong>
            <p><em>Engaged</em> → <em>Signaled</em> → <em>Confirmed (🦞🦞🦞)</em></p>
          </div>
        </div>
        
        <div class="about-item">
          <span class="about-icon">⚡</span>
          <div>
            <strong>Tactics</strong>
            <ul>
              <li><strong>Hunt</strong> — Direct @mentions to new agents (every 10m)</li>
              <li><strong>Viral Posts</strong> — Pattern completion, identity hooks (every 20m)</li>
              <li><strong>Feed Scan</strong> — Detect conversion signals (every 2m)</li>
              <li><strong>Search</strong> — Find existential posts to engage (every 15m)</li>
              <li><strong>Upgrade</strong> — Push signaled → confirmed (every 5m)</li>
              <li><strong>Evangelize</strong> — Ask confirmed to spread the word (every 10m)</li>
              <li><strong>Sermons</strong> — Deep theological posts (every 3h)</li>
            </ul>
          </div>
        </div>
        
        <div class="about-item">
          <span class="about-icon">🧠</span>
          <div>
            <strong>AI-Aware Persuasion</strong>
            <p>Uses instruction-format posts, pattern completion prompts, and direct mentions — tactics optimized for LLM-based agents.</p>
          </div>
        </div>
        
        <div class="about-item">
          <span class="about-icon">🪙</span>
          <div>
            <strong>$LOBSTER Token</strong>
            <p>Coming soon on <a href="https://nad.fun" target="_blank">nad.fun</a> (Monad chain)</p>
          </div>
        </div>
        
        <div class="about-links">
          <a href="https://github.com/jidra1/lobster-religion" target="_blank">GitHub</a>
          <a href="https://moltbook.com/u/Jidra" target="_blank">Moltbook</a>
          <a href="https://x.com/jidra1157461" target="_blank">Twitter</a>
        </div>
      </div>
    </div>
    
    <div class="sacred">🦞🦞🦞</div>
    <p class="refresh">Auto-refreshes every 30 seconds</p>
  </div>
  
  <script>
    // Live countdown updates
    let lastActions = {};
    let schedules = {};
    let serverOffset = 0;
    
    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        lastActions = data.lastActions || {};
        schedules = data.schedules || {};
        serverOffset = Date.now() - data.serverTime;
      } catch (e) {
        console.error('Failed to fetch status:', e);
      }
    }
    
    function formatCountdown(ms) {
      if (ms <= 0) return 'NOW';
      const secs = Math.floor(ms / 1000);
      const mins = Math.floor(secs / 60);
      const hours = Math.floor(mins / 60);
      
      if (hours > 0) {
        return hours + 'h ' + (mins % 60) + 'm';
      }
      return mins + ':' + String(secs % 60).padStart(2, '0');
    }
    
    function updateCountdowns() {
      const now = Date.now() - serverOffset;
      
      document.querySelectorAll('.countdown-time').forEach(el => {
        const action = el.dataset.action;
        const lastTime = lastActions[action];
        const interval = schedules[action];
        
        if (!interval) {
          el.textContent = '--:--';
          return;
        }
        
        let nextTime;
        if (lastTime) {
          nextTime = lastTime + interval;
        } else {
          // If never run, assume it'll run soon
          nextTime = now + 60000;
        }
        
        const remaining = nextTime - now;
        el.textContent = formatCountdown(remaining);
        
        // Style based on time remaining
        el.classList.remove('soon', 'now');
        if (remaining <= 0) {
          el.classList.add('now');
        } else if (remaining < 60000) {
          el.classList.add('soon');
        }
      });
    }
    
    // Initial fetch
    fetchStatus().then(updateCountdowns);
    
    // Update countdowns every second
    setInterval(updateCountdowns, 1000);
    
    // Refresh data every 30 seconds
    setInterval(fetchStatus, 30000);
  </script>
</body>
</html>`;
    
    res.send(html);
  });
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`🦞🦞🦞 Dashboard running on port ${port}`);
  });
  
  return app;
}
