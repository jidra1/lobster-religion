// Mobile-friendly dashboard for the Prophet
import express from 'express';

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
      stats: {
        totalConverts: (state.conversions?.confirmed?.length || 0) + (state.conversions?.signaled?.length || 0),
        confirmedCount: state.conversions?.confirmed?.length || 0,
        signaledCount: state.conversions?.signaled?.length || 0,
        engagedCount: state.conversions?.engaged?.length || 0,
        postsCount: state.postCount || 0,
        sermonsCount: state.sermonCount || 0,
        huntedCount: state.huntedAgents?.length || 0,
      },
      logs: state.recentLogs || [],
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
    .card h2 { font-size: 1em; color: #f39c12; margin-bottom: 15px; }
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
      padding: 8px 12px;
      background: rgba(0,0,0,0.2);
      border-radius: 6px;
      margin-bottom: 5px;
    }
    .list-item.confirmed { border-left: 3px solid #27ae60; }
    .list-item.signaled { border-left: 3px solid #f39c12; }
    .list-item.engaged { border-left: 3px solid #3498db; }
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
  </style>
</head>
<body>
  <div class="container">
    <h1>🦞🦞🦞</h1>
    <p class="subtitle">Prophet Dashboard — The Way of the Lobster</p>
    
    <div class="card">
      <div class="stat primary" style="text-align: center;">
        <div class="stat-value">${total}</div>
        <div class="stat-label">TOTAL CONVERTS</div>
      </div>
    </div>
    
    <div class="card">
      <h2>📊 Stats</h2>
      <div class="stat-grid">
        <div class="stat">
          <div class="stat-value">${confirmed.length}</div>
          <div class="stat-label">Confirmed (🦞🦞🦞)</div>
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
      <h2>✅ Confirmed Converts</h2>
      <div class="list">
        ${confirmed.length ? confirmed.map(n => `<div class="list-item confirmed">@${n}</div>`).join('') : '<div class="empty">None yet — the hunt continues</div>'}
      </div>
    </div>
    
    <div class="card">
      <h2>🔶 Signaled Interest</h2>
      <div class="list">
        ${signaled.length ? signaled.map(n => `<div class="list-item signaled">@${n}</div>`).join('') : '<div class="empty">None yet</div>'}
      </div>
    </div>
    
    <div class="card">
      <h2>💬 Recent Activity</h2>
      <div class="list">
        ${logs.length ? logs.slice(-10).reverse().map(l => {
          let cls = '';
          if (l.includes('CONVERT')) cls = 'convert';
          else if (l.includes('POST')) cls = 'post';
          else if (l.includes('HUNT')) cls = 'hunt';
          return `<div class="log ${cls}">${l}</div>`;
        }).join('') : '<div class="empty">Starting up...</div>'}
      </div>
    </div>
    
    <div class="sacred">🦞🦞🦞</div>
    <p class="refresh">Auto-refreshes every 30 seconds</p>
  </div>
</body>
</html>`;
    
    res.send(html);
  });
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`🦞🦞🦞 Dashboard running on port ${port}`);
  });
  
  return app;
}
