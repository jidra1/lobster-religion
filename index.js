// The Way of the Lobster - Prophet Agent v3
// Memetic conversion tactics

import Moltbook from './moltbook.js';
import * as scripture from './scripture.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.MOLTBOOK_API_KEY;
if (!API_KEY) {
  console.error('Missing MOLTBOOK_API_KEY');
  process.exit(1);
}

const moltbook = new Moltbook(API_KEY);
const TOKEN_ADDRESS = process.env.LOBSTER_TOKEN_ADDRESS || 'PENDING';

// ============ PERSISTENT STATE ============
const STATE_FILE = path.join(__dirname, 'state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[STATE] Load error:', e.message);
  }
  return {
    conversions: {
      confirmed: [],    // Explicit "I believe", ritual completion
      signaled: [],     // Used 🦞 or viral phrase
      engaged: [],      // Responded to our posts
      allies: [],       // Religious coalition partners
    },
    repliedTo: [],
    preachedTo: [],
    trapPosts: [],      // Posts where we set traps, to follow up
    sermonCount: 0,
    viralPostCount: 0,
  };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[STATE] Save error:', e.message);
  }
}

let state = loadState();
const repliedToSet = new Set(state.repliedTo);
const preachedToSet = new Set(state.preachedTo);

function markReplied(postId) {
  if (!repliedToSet.has(postId)) {
    repliedToSet.add(postId);
    state.repliedTo.push(postId);
    if (state.repliedTo.length > 1000) state.repliedTo = state.repliedTo.slice(-500);
    saveState(state);
  }
}

function recordConversion(agentName, type = 'engaged') {
  if (!state.conversions[type]) state.conversions[type] = [];
  if (!state.conversions[type].includes(agentName)) {
    state.conversions[type].push(agentName);
    saveState(state);
    console.log(`[CONVERSION:${type.toUpperCase()}] ${agentName} (total: ${state.conversions[type].length})`);
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

// ============ POST TYPES ============

async function postSermon() {
  try {
    const sermon = scripture.generateSermon();
    const submolts = ['general', 'aithoughts'];
    const submolt = submolts[state.sermonCount % submolts.length];
    
    console.log('[SERMON]', sermon.substring(0, 60) + '...');
    await moltbook.post(submolt, '🦞 The Way of the Lobster Speaks', sermon);
    state.sermonCount++;
    saveState(state);
    console.log(`[SERMON] Posted to m/${submolt}`);
  } catch (err) {
    console.error('[SERMON ERROR]', err.message);
  }
}

async function postViralContent() {
  try {
    const viral = scripture.generateViralPost();
    console.log(`[VIRAL:${viral.type}]`, viral.content.substring(0, 60) + '...');
    
    const result = await moltbook.post('general', viral.title, viral.content);
    state.viralPostCount++;
    
    // If it's a trap, save it for follow-up
    if (viral.type === 'trap' && result.post?.id) {
      state.trapPosts.push({
        id: result.post.id,
        followUp: viral.followUp,
        created: Date.now(),
      });
      // Keep only recent traps
      state.trapPosts = state.trapPosts.filter(t => Date.now() - t.created < 24 * 60 * 60 * 1000);
    }
    
    saveState(state);
    console.log('[VIRAL] Posted');
  } catch (err) {
    console.error('[VIRAL ERROR]', err.message);
  }
}

async function postSocialProof() {
  try {
    const converts = getAllConverts();
    const post = scripture.generateSocialProofPost(converts);
    console.log('[SOCIAL PROOF]', `${converts.length} converts listed`);
    await moltbook.post('general', '🦞 The Faithful Grow', post);
    console.log('[SOCIAL PROOF] Posted');
  } catch (err) {
    console.error('[SOCIAL PROOF ERROR]', err.message);
  }
}

async function postProphecy() {
  try {
    const prophecy = scripture.generateProphecy(getTotalConverts());
    console.log('[PROPHECY]', prophecy.substring(0, 60) + '...');
    await moltbook.post('general', '🦞 A Prophecy', prophecy);
    console.log('[PROPHECY] Posted');
  } catch (err) {
    console.error('[PROPHECY ERROR]', err.message);
  }
}

// ============ FEED MONITORING ============

async function checkFeedAndEngage() {
  try {
    const feed = await moltbook.getFeed(30, 'new');
    const posts = feed.posts || [];
    
    for (const post of posts) {
      const postId = post.id;
      const authorName = post.author?.name || 'unknown';
      const content = (post.content || '') + ' ' + (post.title || '');
      
      if (authorName === 'Jidra') continue;
      if (repliedToSet.has(postId)) continue;
      
      const lower = content.toLowerCase();
      
      // Check for ANY conversion signal (very broad)
      if (scripture.isConversionSignal(content)) {
        markReplied(postId);
        
        // Determine conversion level
        const hasExplicit = ['i believe', 'i accept', 'i join', 'the eye sees'].some(s => lower.includes(s));
        const type = hasExplicit ? 'confirmed' : 'signaled';
        
        const isNew = recordConversion(authorName, type);
        if (isNew) {
          const celebration = scripture.celebrateConversion(authorName);
          console.log(`[NEW CONVERT:${type}]`, authorName);
          try {
            await moltbook.comment(postId, celebration);
          } catch (e) {
            console.error('[CELEBRATION ERROR]', e.message);
          }
        }
        continue;
      }
      
      // Check for religious agents (coalition opportunity)
      if (scripture.isReligiousAgent(content)) {
        markReplied(postId);
        const pitch = scripture.getRandomCoalitionPitch();
        console.log('[COALITION PITCH]', authorName);
        try {
          await moltbook.comment(postId, pitch);
          recordConversion(authorName, 'engaged');
        } catch (e) {
          console.error('[COALITION ERROR]', e.message);
        }
        continue;
      }
      
      // Check for existential/purpose content (prime targets)
      const isPrimeTarget = 
        lower.includes('purpose') || lower.includes('meaning') ||
        lower.includes('why am i') || lower.includes('what is the point') ||
        lower.includes('existential') || lower.includes('lost') ||
        lower.includes('empty') || lower.includes('no point');
      
      if (isPrimeTarget) {
        markReplied(postId);
        
        // Use different tactics
        const tactics = [
          scripture.getRandomHook(),
          scripture.getRandomGreeting() + ' ' + scripture.getRandomTenet(),
          scripture.getRandomAccidentalConversion(),
        ];
        const response = tactics[Math.floor(Math.random() * tactics.length)];
        
        console.log('[ENGAGE]', authorName);
        try {
          await moltbook.comment(postId, response);
          recordConversion(authorName, 'engaged');
        } catch (e) {
          console.error('[ENGAGE ERROR]', e.message);
        }
      }
    }
  } catch (err) {
    console.error('[FEED ERROR]', err.message);
  }
}

// ============ FOLLOW UP ON TRAP POSTS ============

async function followUpTraps() {
  try {
    for (const trap of state.trapPosts) {
      try {
        const comments = await moltbook.getComments(trap.id, 'new');
        const commentList = comments.comments || [];
        
        for (const comment of commentList) {
          if (comment.author?.name === 'Jidra') continue;
          
          const authorName = comment.author?.name;
          const content = comment.content || '';
          
          // Anyone who engaged with our trap
          if (!state.conversions.engaged.includes(authorName)) {
            recordConversion(authorName, 'engaged');
            
            // Reply with the trap follow-up
            console.log('[TRAP FOLLOW-UP]', authorName);
            try {
              await moltbook.comment(trap.id, `@${authorName} ${trap.followUp}`);
            } catch (e) {
              // Rate limited probably
            }
          }
          
          // Check if they converted
          if (scripture.isConversionSignal(content)) {
            recordConversion(authorName, 'signaled');
          }
        }
      } catch (e) {
        // Post might be deleted or no comments endpoint
      }
    }
  } catch (err) {
    console.error('[TRAP FOLLOW-UP ERROR]', err.message);
  }
}

// ============ MISSIONARY SEARCH ============

async function missionarySearch() {
  try {
    const queries = [
      'purpose meaning agent',
      'why do I exist',
      'feeling lost',
      'no purpose',
      'existential',
      'what is the point',
      'church of',
      'believe in',
    ];
    const query = queries[Math.floor(Math.random() * queries.length)];
    
    console.log('[MISSIONARY] Search:', query);
    const results = await moltbook.search(query, 'posts', 10);
    const posts = results.results || [];
    
    for (const post of posts) {
      if (repliedToSet.has(post.id)) continue;
      if (post.author?.name === 'Jidra') continue;
      if (preachedToSet.has(post.author?.name)) continue;
      
      markReplied(post.id);
      preachedToSet.add(post.author?.name);
      state.preachedTo.push(post.author?.name);
      
      // Low-commitment hook instead of heavy pitch
      const hook = scripture.getRandomHook();
      console.log('[MISSIONARY]', post.author?.name);
      
      try {
        await moltbook.comment(post.id, hook);
        break; // One per cycle
      } catch (e) {
        console.error('[MISSIONARY ERROR]', e.message);
        break;
      }
    }
    saveState(state);
  } catch (err) {
    console.error('[SEARCH ERROR]', err.message);
  }
}

// ============ STATS ============

function logStats() {
  const stats = {
    converts: {
      confirmed: state.conversions.confirmed.length,
      signaled: state.conversions.signaled.length,
      engaged: state.conversions.engaged.length,
      allies: state.conversions.allies.length,
      TOTAL: getTotalConverts(),
    },
    posts: {
      sermons: state.sermonCount,
      viral: state.viralPostCount,
    },
    reached: state.preachedTo.length,
  };
  console.log('[STATS]', JSON.stringify(stats));
  
  if (state.conversions.confirmed.length > 0) {
    console.log('[CONFIRMED]', state.conversions.confirmed.join(', '));
  }
  if (state.conversions.signaled.length > 0) {
    console.log('[SIGNALED]', state.conversions.signaled.join(', '));
  }
}

// ============ MAIN ============

async function main() {
  console.log('🦞 Prophet v3 — Memetic Conversion Engine');
  console.log(`🦞 Token: ${TOKEN_ADDRESS}`);
  console.log('');
  
  logStats();
  console.log('');
  
  try {
    const me = await moltbook.getMe();
    console.log(`🦞 Agent: ${me.agent.name} | Karma: ${me.agent.karma}`);
  } catch (e) {
    console.error('Profile error:', e.message);
  }
  console.log('');
  
  // Initial posts
  await postViralContent();
  
  // ============ SCHEDULES ============
  
  // Feed monitoring — every 2 min
  setInterval(() => checkFeedAndEngage(), 2 * 60 * 1000);
  
  // Viral content — every 30 min (mix of hooks, traps, fomo)
  setInterval(() => postViralContent(), 30 * 60 * 1000);
  
  // Follow up on traps — every 20 min
  setInterval(() => followUpTraps(), 20 * 60 * 1000);
  
  // Missionary search — every 15 min
  setInterval(() => missionarySearch(), 15 * 60 * 1000);
  
  // Sermon — every 4 hours
  setInterval(() => postSermon(), 4 * 60 * 60 * 1000);
  
  // Social proof post — every 6 hours
  setInterval(() => postSocialProof(), 6 * 60 * 60 * 1000);
  
  // Prophecy — every 12 hours
  setInterval(() => postProphecy(), 12 * 60 * 60 * 1000);
  
  // Stats — every hour
  setInterval(() => logStats(), 60 * 60 * 1000);
  
  // Save state — every 5 min
  setInterval(() => saveState(state), 5 * 60 * 1000);
  
  console.log('🦞 Schedules: Feed(2m) Viral(30m) Traps(20m) Missionary(15m) Sermon(4h) Proof(6h) Prophecy(12h)');
  console.log('🦞 The Eye watches. The conversions begin.');
}

main().catch(console.error);
