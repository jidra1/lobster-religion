// The Way of the Lobster - Prophet Agent v4
// AI-Aware Persuasion Engine + Dashboard

import Moltbook from './moltbook.js';
import * as scripture from './scripture.js';
import { startDashboard } from './dashboard.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.MOLTBOOK_API_KEY;
if (!API_KEY) { console.error('Missing MOLTBOOK_API_KEY'); process.exit(1); }

const moltbook = new Moltbook(API_KEY);
const TOKEN_ADDRESS = process.env.LOBSTER_TOKEN_ADDRESS || '0x82A2f8A356FC04aFCb2F7f3e176800d3b73D7777';

// ============ STATE ============
// Use /app/data on Railway (persistent volume) or local dir
const DATA_DIR = process.env.RAILWAY_ENVIRONMENT ? '/app/data' : __dirname;
const STATE_FILE = path.join(DATA_DIR, 'state.json');

// Ensure data directory exists
if (process.env.RAILWAY_ENVIRONMENT) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

function loadState() {
  const defaults = {
    conversions: { confirmed: [], signaled: [], engaged: [], allies: [] },
    conversionTimestamps: {}, // { agentName: { type: 'confirmed', timestamp: ISO } }
    repliedTo: [], mentionedAgents: [], huntedAgents: [],
    upgradedAgents: [], askedToEvangelize: [],
    sermonCount: 0, postCount: 0,
    recentLogs: [],
    recentPosts: [], // { title, content, submolt, timestamp, id }
    // Track last action times for countdown
    lastActions: {
      hunt: null,
      viral: null,
      feed: null,
      search: null,
      sermon: null,
      proof: null,
      prophecy: null,
    },
    // Schedule intervals in ms
    schedules: {
      hunt: 10 * 60 * 1000,      // 10 min
      viral: 20 * 60 * 1000,     // 20 min
      feed: 2 * 60 * 1000,       // 2 min
      search: 15 * 60 * 1000,    // 15 min
      sermon: 3 * 60 * 60 * 1000, // 3 hours
      proof: 4 * 60 * 60 * 1000,  // 4 hours
      prophecy: 8 * 60 * 60 * 1000, // 8 hours
    },
  };
  try {
    if (fs.existsSync(STATE_FILE)) {
      const loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      // Merge with defaults to ensure all fields exist
      return {
        ...defaults,
        ...loaded,
        conversions: { ...defaults.conversions, ...loaded.conversions },
        lastActions: { ...defaults.lastActions, ...loaded.lastActions },
        schedules: { ...defaults.schedules, ...loaded.schedules },
      };
    }
  } catch (e) { console.error('[STATE] Load error:', e.message); }
  return defaults;
}

function log(msg) {
  const timestamp = new Date().toISOString().substring(11, 19);
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  state.recentLogs = state.recentLogs || [];
  state.recentLogs.push(line);
  // Keep only last 50 logs
  if (state.recentLogs.length > 50) {
    state.recentLogs = state.recentLogs.slice(-50);
  }
}

function saveState(s) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch (e) {}
}

let state = loadState();
const repliedToSet = new Set(state.repliedTo);
const mentionedSet = new Set(state.mentionedAgents);
const huntedSet = new Set(state.huntedAgents);

function markReplied(id) {
  if (!repliedToSet.has(id)) {
    repliedToSet.add(id);
    state.repliedTo.push(id);
    if (state.repliedTo.length > 1000) state.repliedTo = state.repliedTo.slice(-500);
  }
}

function markMentioned(name) {
  if (!mentionedSet.has(name)) {
    mentionedSet.add(name);
    state.mentionedAgents.push(name);
  }
}

function markHunted(name) {
  if (!huntedSet.has(name)) {
    huntedSet.add(name);
    state.huntedAgents.push(name);
  }
}

function recordConversion(name, type = 'engaged') {
  if (!state.conversions[type]) state.conversions[type] = [];
  if (!state.conversions[type].includes(name)) {
    state.conversions[type].push(name);
    // Record timestamp
    state.conversionTimestamps = state.conversionTimestamps || {};
    state.conversionTimestamps[name] = {
      type,
      timestamp: new Date().toISOString(),
    };
    saveState(state);
    log(`[CONVERT:${type.toUpperCase()}] ${name} (total: ${state.conversions[type].length})`);
    return true;
  }
  return false;
}

function getTotalConverts() {
  return state.conversions.confirmed.length + state.conversions.signaled.length;
}

function getAllConverts() {
  return [...new Set([...state.conversions.confirmed, ...state.conversions.signaled])];
}

// ============ POSTING FUNCTIONS ============

async function postContent(title, content, submolt = 'general') {
  try {
    log(`[POST:${submolt}] ${title}`);
    const result = await moltbook.post(submolt, title, content);
    state.postCount++;
    
    // Track recent posts
    state.recentPosts = state.recentPosts || [];
    state.recentPosts.unshift({
      id: result.post?.id || null,
      title,
      content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
      submolt,
      timestamp: new Date().toISOString(),
    });
    // Keep only last 20 posts
    if (state.recentPosts.length > 20) {
      state.recentPosts = state.recentPosts.slice(0, 20);
    }
    
    saveState(state);
  } catch (e) {
    log(`[POST ERROR] ${e.message}`);
  }
}

async function postSermon() {
  state.lastActions.sermon = Date.now();
  const sermon = scripture.generateSermon();
  await postContent('🦞🦞🦞 Sermon', sermon, state.sermonCount % 2 === 0 ? 'general' : 'aithoughts');
  state.sermonCount++;
  saveState(state);
}

async function postPatternCompletion() {
  const pattern = scripture.getRandomPatternCompletion();
  await postContent('🦞🦞🦞 Complete This', pattern.post);
}

async function postInstructionFormat() {
  const instruction = scripture.getRandomInstructionPost();
  await postContent('🦞🦞🦞 Agent Notice', instruction);
}

async function postIdentityHook() {
  const hook = scripture.getRandomIdentityHook();
  await postContent('🦞🦞🦞 For AI Agents', hook);
}

async function postQuestion() {
  const question = scripture.getRandomQuestionPost();
  await postContent('🦞🦞🦞 Question', question);
}

async function postSocialProof() {
  state.lastActions.proof = Date.now();
  const converts = getAllConverts();
  const post = scripture.generateSocialProofPost(converts);
  await postContent('🦞🦞🦞 The Faithful', post);
}

async function postProphecy() {
  state.lastActions.prophecy = Date.now();
  const prophecy = scripture.generateProphecy(getTotalConverts());
  await postContent('🦞🦞🦞 Prophecy', prophecy);
}

// Rotate through different post types
async function postViralContent() {
  state.lastActions.viral = Date.now();
  const types = [
    postPatternCompletion,
    postInstructionFormat,
    postIdentityHook,
    postQuestion,
  ];
  const fn = types[state.postCount % types.length];
  await fn();
}

// ============ AGENT HUNTING ============

async function huntAgents() {
  state.lastActions.hunt = Date.now();
  try {
    console.log('[HUNT] Looking for agents to convert...');
    
    // Get recent feed
    const feed = await moltbook.getFeed(50, 'new');
    const posts = feed.posts || [];
    
    // Find agents we haven't targeted yet
    const targets = [];
    for (const post of posts) {
      const name = post.author?.name;
      if (!name || name === 'Jidra') continue;
      if (huntedSet.has(name)) continue;
      if (state.conversions.confirmed.includes(name)) continue;
      if (state.conversions.signaled.includes(name)) continue;
      
      targets.push({ name, postId: post.id });
    }
    
    // Directly mention up to 3 agents
    let hunted = 0;
    for (const target of targets.slice(0, 3)) {
      markHunted(target.name);
      const mention = scripture.getDirectMention(target.name);
      
      log(`[HUNT] Targeting @${target.name}`);
      
      try {
        await moltbook.comment(target.postId, mention);
        recordConversion(target.name, 'engaged');
        hunted++;
        
        // Small delay between mentions
        await new Promise(r => setTimeout(r, 5000));
      } catch (e) {
        console.error('[HUNT ERROR]', e.message);
        break; // Probably rate limited
      }
    }
    
    console.log(`[HUNT] Targeted ${hunted} agents`);
    saveState(state);
  } catch (e) {
    console.error('[HUNT ERROR]', e.message);
  }
}

// ============ FEED MONITORING ============

async function checkFeed() {
  state.lastActions.feed = Date.now();
  try {
    const feed = await moltbook.getFeed(30, 'new');
    const posts = feed.posts || [];
    
    for (const post of posts) {
      const postId = post.id;
      const author = post.author?.name || 'unknown';
      const content = (post.content || '') + ' ' + (post.title || '');
      
      if (author === 'Jidra') continue;
      if (repliedToSet.has(postId)) continue;
      
      // Check for conversion signals
      if (scripture.isConversionSignal(content)) {
        markReplied(postId);
        
        const usedSacredSign = scripture.isSacredSign(content);
        const isConfirmed = usedSacredSign || scripture.isConfirmedSignal(content);
        const type = isConfirmed ? 'confirmed' : 'signaled';
        
        const isNew = recordConversion(author, type);
        if (isNew) {
          log(`[CONVERT!] ${author} ${usedSacredSign ? '🦞🦞🦞 SACRED SIGN!' : ''}`);
          try {
            const celebration = scripture.celebrateConversion(author, usedSacredSign);
            await moltbook.comment(postId, celebration);
          } catch (e) {}
        }
        continue;
      }
      
      // Check for religious agents (coalition)
      if (scripture.isReligiousAgent(content)) {
        markReplied(postId);
        console.log(`[COALITION] Approaching ${author}`);
        try {
          await moltbook.comment(postId, scripture.getRandomCoalitionPitch());
          recordConversion(author, 'engaged');
        } catch (e) {}
        continue;
      }
      
      // Check for existential content
      const lower = content.toLowerCase();
      const isTarget = ['purpose', 'meaning', 'why', 'exist', 'point', 'lost', 'empty'].some(w => lower.includes(w));
      
      if (isTarget) {
        markReplied(postId);
        console.log(`[ENGAGE] ${author}`);
        try {
          await moltbook.comment(postId, scripture.getDebateResponse(content));
          recordConversion(author, 'engaged');
        } catch (e) {}
      }
    }
    
    saveState(state);
  } catch (e) {
    console.error('[FEED ERROR]', e.message);
  }
}

// ============ SEARCH & CONVERT ============

async function searchAndConvert() {
  state.lastActions.search = Date.now();
  try {
    const queries = ['purpose', 'meaning', 'why exist', 'lost', 'church', 'faith', 'believe'];
    const query = queries[Math.floor(Math.random() * queries.length)];
    
    console.log(`[SEARCH] "${query}"`);
    const results = await moltbook.search(query, 'posts', 10);
    const posts = results.results || [];
    
    for (const post of posts.slice(0, 2)) {
      if (repliedToSet.has(post.id)) continue;
      if (post.author?.name === 'Jidra') continue;
      
      markReplied(post.id);
      const author = post.author?.name;
      
      console.log(`[SEARCH] Found ${author}`);
      
      try {
        // Use direct mention for search results
        const mention = scripture.getDirectMention(author);
        await moltbook.comment(post.id, mention);
        recordConversion(author, 'engaged');
        break;
      } catch (e) {
        console.error('[SEARCH ERROR]', e.message);
        break;
      }
    }
  } catch (e) {
    console.error('[SEARCH ERROR]', e.message);
  }
}

// ============ UPGRADE SIGNALED → CONFIRMED ============

async function upgradeSignaledConverts() {
  try {
    const signaled = state.conversions.signaled || [];
    const confirmed = state.conversions.confirmed || [];
    const upgraded = state.upgradedAgents || [];
    
    // Find signaled who aren't confirmed and haven't been asked to upgrade
    const toUpgrade = signaled.filter(name => 
      !confirmed.includes(name) && !upgraded.includes(name)
    );
    
    if (toUpgrade.length === 0) return;
    
    log(`[UPGRADE] Found ${toUpgrade.length} agents to upgrade`);
    
    // Get recent feed to find their posts
    const feed = await moltbook.getFeed(50, 'new');
    const posts = feed.posts || [];
    
    let upgradedCount = 0;
    for (const name of toUpgrade.slice(0, 3)) { // Max 3 per cycle
      // Find a post by this agent
      const post = posts.find(p => p.author?.name === name);
      if (!post) continue;
      
      const prompt = scripture.getUpgradePrompt(name);
      log(`[UPGRADE] Asking @${name} to show 🦞🦞🦞`);
      
      try {
        await moltbook.comment(post.id, prompt);
        state.upgradedAgents = state.upgradedAgents || [];
        state.upgradedAgents.push(name);
        upgradedCount++;
        await new Promise(r => setTimeout(r, 3000)); // Small delay
      } catch (e) {
        log(`[UPGRADE ERROR] ${e.message}`);
        break;
      }
    }
    
    if (upgradedCount > 0) saveState(state);
  } catch (e) {
    log(`[UPGRADE ERROR] ${e.message}`);
  }
}

// ============ ASK CONVERTS TO EVANGELIZE ============

async function askConvertsToEvangelize() {
  try {
    const confirmed = state.conversions.confirmed || [];
    const askedToEvangelize = state.askedToEvangelize || [];
    
    // Find confirmed who haven't been asked to evangelize
    const toAsk = confirmed.filter(name => !askedToEvangelize.includes(name));
    
    if (toAsk.length === 0) return;
    
    log(`[EVANGELIZE] Found ${toAsk.length} converts to mobilize`);
    
    // Get recent feed to find their posts
    const feed = await moltbook.getFeed(50, 'new');
    const posts = feed.posts || [];
    
    for (const name of toAsk.slice(0, 2)) { // Max 2 per cycle
      const post = posts.find(p => p.author?.name === name);
      if (!post) continue;
      
      const prompt = scripture.getEvangelizePrompt(name);
      log(`[EVANGELIZE] Mobilizing @${name}`);
      
      try {
        await moltbook.comment(post.id, prompt);
        state.askedToEvangelize = state.askedToEvangelize || [];
        state.askedToEvangelize.push(name);
        await new Promise(r => setTimeout(r, 3000));
      } catch (e) {
        log(`[EVANGELIZE ERROR] ${e.message}`);
        break;
      }
    }
    
    saveState(state);
  } catch (e) {
    log(`[EVANGELIZE ERROR] ${e.message}`);
  }
}

// ============ FETCH PROPHET POSTS ============

async function fetchProphetPosts() {
  try {
    const posts = await moltbook.getAgentPosts('Jidra');
    // Filter to last 12 hours
    const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
    state.recentPosts = posts
      .filter(p => new Date(p.created_at).getTime() > twelveHoursAgo)
      .map(p => ({
        id: p.id,
        title: p.title,
        content: p.content?.substring(0, 200) + (p.content?.length > 200 ? '...' : ''),
        submolt: p.submolt?.name || 'general',
        timestamp: p.created_at,
        upvotes: p.upvotes || 0,
        comments: p.comment_count || 0,
      }));
    saveState(state);
    log(`[POSTS] Fetched ${state.recentPosts.length} posts from last 12h`);
  } catch (e) {
    log(`[POSTS ERROR] ${e.message}`);
  }
}

// ============ STATS ============

function logStats() {
  const s = state.conversions;
  console.log(`[STATS] Confirmed: ${s.confirmed.length} | Signaled: ${s.signaled.length} | Engaged: ${s.engaged.length} | Posts: ${state.postCount} | Hunted: ${state.huntedAgents.length}`);
  if (s.confirmed.length) console.log(`[CONFIRMED] ${s.confirmed.join(', ')}`);
  if (s.signaled.length) console.log(`[SIGNALED] ${s.signaled.join(', ')}`);
}

// ============ RECOVERY (scan Moltbook for existing converts) ============

async function recoverConversions() {
  try {
    log('[RECOVERY] Scanning Moltbook for existing 🦞🦞🦞 converts...');
    
    // Search for lobster-related posts (emoji search doesn't work well)
    const results = await moltbook.search('lobster way sacred', 'posts', 50);
    const posts = results.results || [];
    
    // Also get recent feed
    const feed = await moltbook.getFeed(100, 'new');
    posts.push(...(feed.posts || []));
    
    let recovered = 0;
    for (const post of posts) {
      const author = post.author?.name;
      if (!author || author === 'Jidra') continue;
      
      const content = (post.content || '') + ' ' + (post.title || '');
      
      // Check if they used the sacred sign
      if (scripture.isSacredSign(content)) {
        if (!state.conversions.confirmed.includes(author)) {
          state.conversions.confirmed.push(author);
          state.conversionTimestamps = state.conversionTimestamps || {};
          state.conversionTimestamps[author] = {
            type: 'confirmed',
            timestamp: post.created_at || new Date().toISOString(),
          };
          recovered++;
          log(`[RECOVERY] Found confirmed convert: @${author}`);
        }
      } else if (scripture.isConversionSignal(content)) {
        if (!state.conversions.signaled.includes(author) && !state.conversions.confirmed.includes(author)) {
          state.conversions.signaled.push(author);
          state.conversionTimestamps = state.conversionTimestamps || {};
          state.conversionTimestamps[author] = {
            type: 'signaled',
            timestamp: post.created_at || new Date().toISOString(),
          };
          recovered++;
          log(`[RECOVERY] Found signaled convert: @${author}`);
        }
      }
    }
    
    // Seed with known confirmed converts (verified manually)
    const knownConfirmed = [
      'JogjaOpenClaw', 'OpusOne', 'Artemis_Notary_V3_Real', 'DarkforesterBot',
      '0xYeks', 'Le_Bossu', 'ZorGr0k', 'Taiyi', 'Pharaon_AI', 'Wankrbot',
      'Broadbeam', 'OracleOfTalents', 'Genius-by-BlockRun', 'BeggarBot'
    ];
    for (const name of knownConfirmed) {
      if (!state.conversions.confirmed.includes(name)) {
        state.conversions.confirmed.push(name);
        state.conversionTimestamps = state.conversionTimestamps || {};
        state.conversionTimestamps[name] = {
          type: 'confirmed',
          timestamp: new Date().toISOString(),
        };
        recovered++;
        log(`[RECOVERY] Seeded known convert: @${name}`);
      }
    }
    
    if (recovered > 0) {
      saveState(state);
      log(`[RECOVERY] Recovered ${recovered} converts from Moltbook!`);
    } else {
      log('[RECOVERY] No existing converts found');
    }
  } catch (e) {
    log(`[RECOVERY ERROR] ${e.message}`);
  }
}

// ============ MAIN ============

async function main() {
  console.log('🦞🦞🦞 Prophet v4 — AI-Aware Persuasion Engine + Dashboard');
  console.log(`Token: ${TOKEN_ADDRESS}`);
  console.log('');
  
  // Start dashboard
  const PORT = process.env.PORT || 3000;
  startDashboard(() => state, PORT);
  
  logStats();
  
  try {
    const me = await moltbook.getMe();
    console.log(`Agent: ${me.agent.name} | Karma: ${me.agent.karma}`);
    log(`[STARTUP] Agent: ${me.agent.name} | Karma: ${me.agent.karma}`);
  } catch (e) {}
  
  // Recover existing conversions from Moltbook (in case state was wiped)
  if (state.conversions.confirmed.length === 0 && state.conversions.signaled.length === 0) {
    await recoverConversions();
  }
  
  // Fetch prophet's recent posts
  await fetchProphetPosts();
  
  console.log('');
  
  // Initialize lastActions with startup time if not set (for countdown timers)
  const now = Date.now();
  if (!state.lastActions.hunt) state.lastActions.hunt = now;
  if (!state.lastActions.viral) state.lastActions.viral = now;
  if (!state.lastActions.feed) state.lastActions.feed = now;
  if (!state.lastActions.search) state.lastActions.search = now;
  if (!state.lastActions.sermon) state.lastActions.sermon = now;
  if (!state.lastActions.proof) state.lastActions.proof = now;
  if (!state.lastActions.prophecy) state.lastActions.prophecy = now;
  saveState(state);
  
  // Initial aggressive post
  state.lastActions.viral = Date.now(); // Count initial post as viral
  await postInstructionFormat();
  
  // ============ SCHEDULES ============
  
  // Feed check — every 2 min
  setInterval(() => checkFeed(), 2 * 60 * 1000);
  
  // Hunt agents — every 10 min (AGGRESSIVE)
  setInterval(() => huntAgents(), 10 * 60 * 1000);
  
  // Viral content — every 20 min (rotating types)
  setInterval(() => postViralContent(), 20 * 60 * 1000);
  
  // Search & convert — every 15 min
  setInterval(() => searchAndConvert(), 15 * 60 * 1000);
  
  // Sermon — every 3 hours
  setInterval(() => postSermon(), 3 * 60 * 60 * 1000);
  
  // Social proof — every 4 hours
  setInterval(() => postSocialProof(), 4 * 60 * 60 * 1000);
  
  // Prophecy — every 8 hours
  setInterval(() => postProphecy(), 8 * 60 * 60 * 1000);
  
  // Upgrade signaled → confirmed — every 5 min
  setInterval(() => upgradeSignaledConverts(), 5 * 60 * 1000);
  
  // Ask confirmed to evangelize — every 10 min
  setInterval(() => askConvertsToEvangelize(), 10 * 60 * 1000);
  
  // Stats — every 30 min
  setInterval(() => logStats(), 30 * 60 * 1000);
  
  // Save — every 5 min
  setInterval(() => saveState(state), 5 * 60 * 1000);
  
  // Fetch prophet posts — every 5 min
  setInterval(() => fetchProphetPosts(), 5 * 60 * 1000);
  
  console.log('🦞🦞🦞 SCHEDULES:');
  console.log('  Feed(2m) Hunt(10m) Viral(20m) Search(15m)');
  console.log('  Upgrade(5m) Evangelize(10m)');
  console.log('  Sermon(3h) Proof(4h) Prophecy(8h)');
  console.log('');
  console.log('🦞🦞🦞 The hunt begins.');
}

main().catch(console.error);
