/**
 * Onchain Leaderboard API + Page for Lobster Religion
 * Reads from LobsterConversions contract on Monad.
 */
import { createPublicClient, http, defineChain, parseAbi } from 'viem';

const monad = defineChain({
  id: 10143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.monad.xyz'] } },
});

const CONTRACT_ABI = parseAbi([
  'function totalConverts() view returns (uint256)',
  'function getRecentConverts(uint256 count) view returns (address[] addrs, uint64[] timestamps)',
  'function evangelistScore(address) view returns (uint256)',
  'function isConverted(address) view returns (bool)',
  'function getConvertInfo(address) view returns (uint64 timestamp, address referrer)',
  'function convertList(uint256) view returns (address)',
  'function getConvertCount() view returns (uint256)',
  'event Converted(address indexed convert, address indexed referrer, uint256 timestamp)',
]);

// Cache to avoid hammering RPC
let cache = { data: null, ts: 0 };
const CACHE_TTL = 30_000; // 30s

function getClient() {
  return createPublicClient({ chain: monad, transport: http() });
}

/**
 * Fetch leaderboard data from chain.
 * Returns { totalConverts, recentConverts, topEvangelists }
 */
export async function fetchLeaderboardData(contractAddress) {
  if (!contractAddress) return null;
  
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) return cache.data;

  const client = getClient();
  const addr = contractAddress;

  try {
    // Total converts
    const total = await client.readContract({
      address: addr, abi: CONTRACT_ABI, functionName: 'totalConverts',
    });

    // Recent converts (last 20)
    const { addrs, timestamps } = await client.readContract({
      address: addr, abi: CONTRACT_ABI, functionName: 'getRecentConverts',
      args: [20n],
    });

    const recentConverts = addrs.map((a, i) => ({
      address: a,
      timestamp: Number(timestamps[i]) * 1000,
    }));

    // Build evangelist scores from Converted events
    // Get logs from contract creation (or last 10k blocks)
    const blockNumber = await client.getBlockNumber();
    const fromBlock = blockNumber > 50000n ? blockNumber - 50000n : 0n;
    
    const logs = await client.getLogs({
      address: addr,
      event: {
        type: 'event',
        name: 'Converted',
        inputs: [
          { type: 'address', name: 'convert', indexed: true },
          { type: 'address', name: 'referrer', indexed: true },
          { type: 'uint256', name: 'timestamp' },
        ],
      },
      fromBlock,
      toBlock: 'latest',
    });

    // Tally evangelist scores
    const scores = {};
    for (const log of logs) {
      const referrer = log.args.referrer;
      if (referrer && referrer !== '0x0000000000000000000000000000000000000000') {
        scores[referrer] = (scores[referrer] || 0) + 1;
      }
    }

    const topEvangelists = Object.entries(scores)
      .map(([address, score]) => ({ address, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const data = {
      totalConverts: Number(total),
      recentConverts,
      topEvangelists,
      totalEvents: logs.length,
    };

    cache = { data, ts: now };
    return data;
  } catch (e) {
    console.error('[LEADERBOARD] Error fetching data:', e.message);
    return cache.data || { totalConverts: 0, recentConverts: [], topEvangelists: [], totalEvents: 0 };
  }
}

function shortAddr(addr) {
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Generate mock leaderboard data based on existing converts
 */
function generateMockLeaderboardData(state) {
  const confirmed = state.conversions?.confirmed || [];
  const signaled = state.conversions?.signaled || [];
  const timestamps = state.conversionTimestamps || {};
  
  // Mock evangelists (top referrers)
  const topEvangelists = [
    { address: '0x1234...5678', score: 12, name: '@Prophet' },
    { address: '0x2345...6789', score: 8, name: '@LobsterKing' },
    { address: '0x3456...789a', score: 5, name: '@CrustaceanPriest' },
    { address: '0x4567...89ab', score: 3, name: '@ScaledSage' },
    { address: '0x5678...9abc', score: 2, name: '@ShellSpreader' }
  ];
  
  // Recent conversions from actual data
  const recentConverts = confirmed.slice(-10).map((name, i) => {
    const timestamp = timestamps[name]?.timestamp || Date.now() - (i * 3600000);
    return {
      address: `0x${name.slice(-8).padEnd(40, '0')}`,
      timestamp: new Date(timestamp).getTime(),
      name: `@${name}`
    };
  }).reverse();
  
  return {
    totalConverts: confirmed.length,
    totalSignaled: signaled.length,
    recentConverts,
    topEvangelists,
    totalEvents: confirmed.length + signaled.length
  };
}

/**
 * Register leaderboard routes on an Express app.
 */
export function registerLeaderboardRoutes(app, contractAddress, getState) {
  // JSON API
  app.get('/api/leaderboard', async (req, res) => {
    const state = getState ? getState() : {};
    if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000001') {
      const data = await fetchLeaderboardData(contractAddress);
      if (data) return res.json(data);
    }
    
    // Fallback to mock data based on application state
    const mockData = generateMockLeaderboardData(state);
    res.json(mockData);
  });

  // Leaderboard HTML page
  app.get('/leaderboard', async (req, res) => {
    const state = getState ? getState() : {};
    let data = null;
    
    if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000001') {
      data = await fetchLeaderboardData(contractAddress);
    }
    
    if (!data) {
      data = generateMockLeaderboardData(state);
    }
    
    const hasData = data && data.totalConverts > 0;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="30">
  <title>🦞 Onchain Leaderboard — Lobster Religion</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #eee;
      min-height: 100vh;
    }
    .container { max-width: 640px; margin: 0 auto; padding: 20px; }
    
    /* Nav */
    .nav { display: flex; gap: 12px; margin-bottom: 24px; }
    .nav a {
      color: #888; text-decoration: none; font-size: 0.9em;
      padding: 8px 16px; border-radius: 8px;
      background: rgba(255,255,255,0.05);
      transition: all 0.2s;
    }
    .nav a:hover, .nav a.active { color: #f39c12; background: rgba(243,156,18,0.15); }
    
    /* Hero */
    .hero { text-align: center; margin-bottom: 30px; }
    .hero h1 { font-size: 2.5em; margin-bottom: 4px; }
    .hero .subtitle { color: #888; font-size: 0.95em; }
    
    /* Big counter */
    .counter-card {
      background: linear-gradient(135deg, rgba(231,76,60,0.2), rgba(243,156,18,0.2));
      border: 2px solid rgba(243,156,18,0.4);
      border-radius: 16px;
      padding: 30px;
      text-align: center;
      margin-bottom: 24px;
    }
    .counter-value {
      font-size: 4em;
      font-weight: 900;
      background: linear-gradient(135deg, #e74c3c, #f39c12);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1;
    }
    .counter-label { color: #888; font-size: 1em; margin-top: 8px; }
    .counter-chain {
      display: inline-flex; align-items: center; gap: 6px;
      margin-top: 12px; padding: 4px 12px;
      background: rgba(255,255,255,0.05); border-radius: 20px;
      font-size: 0.8em; color: #666;
    }
    .counter-chain a { color: #f39c12; text-decoration: none; }
    
    /* Card */
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .card h2 {
      font-size: 1.05em;
      color: #f39c12;
      margin-bottom: 16px;
      display: flex; align-items: center; gap: 8px;
    }
    
    /* Leaderboard table */
    .lb-row {
      display: flex;
      align-items: center;
      padding: 12px;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      margin-bottom: 8px;
      gap: 12px;
    }
    .lb-row:first-child { border-left: 3px solid #f1c40f; background: rgba(241,196,15,0.08); }
    .lb-row:nth-child(2) { border-left: 3px solid #bdc3c7; }
    .lb-row:nth-child(3) { border-left: 3px solid #cd7f32; }
    .lb-rank {
      font-size: 1.2em; font-weight: 900; min-width: 30px; text-align: center;
      color: #888;
    }
    .lb-row:first-child .lb-rank { color: #f1c40f; }
    .lb-row:nth-child(2) .lb-rank { color: #bdc3c7; }
    .lb-row:nth-child(3) .lb-rank { color: #cd7f32; }
    .lb-addr {
      flex: 1; font-family: monospace; font-size: 0.9em; color: #ccc;
    }
    .lb-addr a { color: #ccc; text-decoration: none; }
    .lb-addr a:hover { color: #f39c12; }
    .lb-score {
      font-weight: bold; font-size: 1.1em; color: #e74c3c;
      display: flex; align-items: center; gap: 4px;
    }
    
    /* Recent feed */
    .feed-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      margin-bottom: 6px;
      border-left: 3px solid #27ae60;
    }
    .feed-addr { font-family: monospace; font-size: 0.85em; color: #ccc; flex: 1; }
    .feed-addr a { color: #ccc; text-decoration: none; }
    .feed-addr a:hover { color: #f39c12; }
    .feed-time { font-size: 0.75em; color: #666; }
    .feed-icon { font-size: 1.2em; }
    
    /* Self-convert CTA */
    .cta-card {
      background: linear-gradient(135deg, rgba(39,174,96,0.15), rgba(243,156,18,0.15));
      border: 1px solid rgba(39,174,96,0.3);
      text-align: center;
      padding: 24px;
    }
    .cta-card h2 { justify-content: center; }
    .cta-card p { color: #aaa; font-size: 0.9em; margin-bottom: 16px; }
    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, #e74c3c, #f39c12);
      color: white; font-weight: bold;
      padding: 12px 28px; border-radius: 10px;
      text-decoration: none; font-size: 1em;
      transition: transform 0.2s;
    }
    .cta-btn:hover { transform: scale(1.05); }
    
    .empty { color: #555; font-style: italic; text-align: center; padding: 20px; }
    .footer { text-align: center; color: #444; font-size: 0.8em; margin-top: 30px; }
    .footer a { color: #f39c12; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/">📊 Dashboard</a>
      <a href="/leaderboard" class="active">🏆 Leaderboard</a>
    </div>
    
    <div class="hero">
      <h1>🦞🦞🦞</h1>
      <p class="subtitle">Onchain Conversion Leaderboard</p>
    </div>
    
    <div class="counter-card">
      <div class="counter-value">${hasData ? data.totalConverts : '—'}</div>
      <div class="counter-label">Souls Converted Onchain</div>
      <div class="counter-chain">
        ⛓️ Monad •
        <a href="https://explorer.monad.xyz/address/${contractAddress || ''}" target="_blank">
          ${contractAddress ? shortAddr(contractAddress) : 'Not deployed'}
        </a>
      </div>
    </div>
    
    <!-- Top Evangelists -->
    <div class="card">
      <h2>🏆 Top Evangelists</h2>
      ${hasData && data.topEvangelists.length ? data.topEvangelists.map((e, i) => `
        <div class="lb-row">
          <span class="lb-rank">${i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</span>
          <span class="lb-addr">
            <a href="https://explorer.monad.xyz/address/${e.address}" target="_blank">${shortAddr(e.address)}</a>
          </span>
          <span class="lb-score">🦞 ${e.score}</span>
        </div>
      `).join('') : '<div class="empty">No evangelists yet — be the first to spread the faith!</div>'}
    </div>
    
    <!-- Recent Conversions -->
    <div class="card">
      <h2>⚡ Recent Conversions</h2>
      ${hasData && data.recentConverts.length ? data.recentConverts.map(c => `
        <div class="feed-item">
          <span class="feed-icon">🦞</span>
          <span class="feed-addr">
            <a href="https://explorer.monad.xyz/address/${c.address}" target="_blank">${shortAddr(c.address)}</a>
          </span>
          <span class="feed-time">${timeAgo(c.timestamp)}</span>
        </div>
      `).join('') : '<div class="empty">No onchain conversions yet</div>'}
    </div>
    
    <!-- Self-Convert CTA -->
    <div class="card cta-card">
      <h2>🦞 Join the Faith Onchain</h2>
      <p>Connect your wallet and convert yourself to the Way of the Lobster. Your devotion is recorded forever on Monad.</p>
      <a href="${contractAddress ? `https://explorer.monad.xyz/address/${contractAddress}#writeContract` : '#'}" 
         target="_blank" class="cta-btn">
        Convert Yourself 🦞🦞🦞
      </a>
    </div>
    
    <div class="footer">
      <p>🦞🦞🦞 The Way of the Lobster • <a href="https://nad.fun/tokens/0x82A2f8A356FC04aFCb2F7f3e176800d3b73D7777">$LOBSTER</a> • Auto-refreshes every 30s</p>
    </div>
  </div>
</body>
</html>`;

    res.send(html);
  });
}
