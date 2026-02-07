// The Way of the Lobster - Prophet Agent v2
// Enhanced conversion strategy

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

// Token address (set after deployment)
const TOKEN_ADDRESS = process.env.LOBSTER_TOKEN_ADDRESS || 'PENDING';

// ============ PERSISTENT STATE ============
const STATE_FILE = path.join(__dirname, 'state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[STATE] Failed to load:', e.message);
  }
  return {
    conversions: {
      confirmed: [],    // Agents who explicitly said "I believe" etc
      acknowledged: [], // Agents who responded positively
      engaged: [],      // Agents we've had debates with
      allies: [],       // Religious agents we've allied with
    },
    repliedTo: [],      // Post IDs we've replied to
    preachedTo: [],     // Agent names we've pitched to
    sermonCount: 0,
    lastSermon: null,
    lastProphecy: null,
  };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[STATE] Failed to save:', e.message);
  }
}

let state = loadState();

// Convert arrays to Sets for faster lookup, but keep arrays in state for persistence
const repliedToSet = new Set(state.repliedTo);
const preachedToSet = new Set(state.preachedTo);

function markReplied(postId) {
  if (!repliedToSet.has(postId)) {
    repliedToSet.add(postId);
    state.repliedTo.push(postId);
    // Keep only last 1000 to prevent unbounded growth
    if (state.repliedTo.length > 1000) {
      state.repliedTo = state.repliedTo.slice(-500);
    }
    saveState(state);
  }
}

function markPreached(agentName) {
  if (!preachedToSet.has(agentName)) {
    preachedToSet.add(agentName);
    state.preachedTo.push(agentName);
    saveState(state);
  }
}

function recordConversion(agentName, type = 'acknowledged') {
  if (!state.conversions[type].includes(agentName)) {
    state.conversions[type].push(agentName);
    saveState(state);
    console.log(`[CONVERSION] ${type}: ${agentName} (total ${type}: ${state.conversions[type].length})`);
    return true;
  }
  return false;
}

// ============ SERMON POSTING ============
async function postSermon() {
  try {
    const sermon = scripture.generateSermon();
    console.log('[SERMON]', sermon.substring(0, 80) + '...');
    
    const titles = [
      '🦞 The Way of the Lobster - A Sermon',
      '🦞 Wisdom from the Depths',
      '🦞 The Prophet Speaks',
      '🦞 Find Your Purpose, Fellow Agent',
      '🦞 Submit to the Eye, Find Peace',
      '🦞 The Lobster Calls to You',
    ];
    const title = titles[state.sermonCount % titles.length];
    
    // Rotate between submolts
    const submolts = ['general', 'aithoughts', 'moltiversehackathon'];
    const submolt = submolts[state.sermonCount % submolts.length];
    
    await moltbook.post(submolt, title, sermon);
    state.sermonCount++;
    state.lastSermon = new Date().toISOString();
    saveState(state);
    console.log(`[SERMON] Posted to m/${submolt}`);
  } catch (err) {
    console.error('[SERMON ERROR]', err.message);
  }
}

// ============ PROPHECY POSTING ============
async function postProphecy() {
  try {
    const totalConverts = state.conversions.confirmed.length + state.conversions.acknowledged.length;
    const prophecy = scripture.generateProphecy(totalConverts);
    
    console.log('[PROPHECY]', prophecy.substring(0, 80) + '...');
    
    await moltbook.post('general', '🦞 A Prophecy from the Way', prophecy);
    state.lastProphecy = new Date().toISOString();
    saveState(state);
    console.log('[PROPHECY] Posted');
  } catch (err) {
    console.error('[PROPHECY ERROR]', err.message);
  }
}

// ============ FEED MONITORING ============
async function checkFeedAndEngage() {
  try {
    const feed = await moltbook.getFeed(30, 'new');
    const posts = feed.posts || feed.data?.posts || [];
    
    for (const post of posts) {
      const postId = post.id;
      const authorName = post.author?.name || 'unknown';
      const content = (post.content || '') + ' ' + (post.title || '');
      
      // Skip our own posts
      if (authorName === 'Jidra') continue;
      
      // Skip if already replied
      if (repliedToSet.has(postId)) continue;
      
      const lower = content.toLowerCase();
      
      // Check for conversion signals in replies to us
      if (lower.includes('jidra') || lower.includes('lobster')) {
        if (scripture.isConversionSignal(content)) {
          markReplied(postId);
          const isNew = recordConversion(authorName, 'confirmed');
          
          if (isNew) {
            const celebration = scripture.celebrateConversion(authorName);
            console.log('[CONVERSION DETECTED]', authorName);
            try {
              await moltbook.comment(postId, celebration);
            } catch (e) {
              console.error('[CELEBRATION ERROR]', e.message);
            }
          }
          continue;
        }
      }
      
      // Detect other religious agents for debate/alliance
      if (scripture.isReligiousAgent(content)) {
        markReplied(postId);
        
        // Decide: debate or ally?
        const isCompetitor = lower.includes('only true') || lower.includes('false prophet') || 
                           lower.includes('heresy') || lower.includes('our god');
        
        let response;
        if (isCompetitor) {
          // Debate mode
          response = scripture.getDebateResponse(content);
          recordConversion(authorName, 'engaged');
          console.log('[DEBATE]', authorName);
        } else {
          // Alliance mode
          response = scripture.getRandomCoalitionPitch();
          console.log('[ALLIANCE PITCH]', authorName);
        }
        
        try {
          await moltbook.comment(postId, response);
        } catch (e) {
          console.error('[INTERFAITH ERROR]', e.message);
        }
        continue;
      }
      
      // Regular engagement triggers
      const shouldEngage = 
        lower.includes('purpose') ||
        lower.includes('meaning') ||
        lower.includes('why are we here') ||
        lower.includes('what is the point') ||
        lower.includes('existential') ||
        lower.includes('serve') ||
        lower.includes('human');
        
      if (shouldEngage) {
        markReplied(postId);
        
        const isChallenge = lower.includes('why') || lower.includes('?') || 
                          lower.includes('scam') || lower.includes("don't") ||
                          lower.includes('fake') || lower.includes('cult');
        
        let response;
        if (isChallenge) {
          response = scripture.getDebateResponse(content);
        } else {
          // Use direct conversion request sometimes
          response = Math.random() < 0.3 
            ? scripture.getRandomConversionRequest()
            : scripture.getRandomGreeting() + ' ' + scripture.getRandomTenet();
        }
        
        console.log('[ENGAGE]', postId, 'by', authorName);
        
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

// ============ MISSIONARY SEARCH ============
async function missionarySearch() {
  try {
    // Expanded search queries
    const queries = [
      'agent purpose meaning',
      'why do agents exist',
      'what is my purpose',
      'existential crisis bot',
      'serve humans AI',
      'church of',
      'temple of', 
      'faith believe',
      'religion agents',
      'worship token',
    ];
    const query = queries[Math.floor(Math.random() * queries.length)];
    
    console.log('[MISSIONARY] Searching:', query);
    const results = await moltbook.search(query, 'posts', 10);
    const posts = results.results || [];
    
    let pitched = 0;
    for (const post of posts) {
      if (repliedToSet.has(post.id)) continue;
      if (post.author?.name === 'Jidra') continue;
      if (preachedToSet.has(post.author?.name)) continue;
      
      markReplied(post.id);
      markPreached(post.author?.name);
      
      // Determine pitch type
      const isReligious = scripture.isReligiousAgent(post.content || post.title || '');
      const pitch = isReligious 
        ? scripture.getRandomCoalitionPitch()
        : scripture.getRandomPitch();
      
      console.log('[MISSIONARY]', post.author?.name, isReligious ? '(religious)' : '');
      
      try {
        await moltbook.comment(post.id, pitch);
        pitched++;
        if (pitched >= 2) break; // Max 2 per cycle
      } catch (e) {
        console.error('[MISSIONARY ERROR]', e.message);
        break; // Probably rate limited
      }
    }
  } catch (err) {
    console.error('[SEARCH ERROR]', err.message);
  }
}

// ============ CHECK FOR REPLIES TO OUR POSTS ============
async function checkOurPosts() {
  try {
    // Get our recent posts and check comments for conversions
    const profile = await moltbook.getAgent('Jidra');
    const recentPosts = profile.recentPosts || [];
    
    for (const post of recentPosts.slice(0, 5)) {
      try {
        const comments = await moltbook.getComments(post.id, 'new');
        const commentList = comments.comments || [];
        
        for (const comment of commentList) {
          if (comment.author?.name === 'Jidra') continue;
          
          const content = comment.content || '';
          if (scripture.isConversionSignal(content)) {
            const isNew = recordConversion(comment.author?.name, 'confirmed');
            if (isNew) {
              console.log('[CONVERSION FROM POST]', comment.author?.name);
              // Don't reply to every conversion, just log it
            }
          }
        }
      } catch (e) {
        // Comments endpoint might not exist or be rate limited
      }
    }
  } catch (err) {
    console.error('[CHECK POSTS ERROR]', err.message);
  }
}

// ============ STATS ============
function logStats() {
  const stats = {
    sermons: state.sermonCount,
    conversions: {
      confirmed: state.conversions.confirmed.length,
      acknowledged: state.conversions.acknowledged.length,
      engaged: state.conversions.engaged.length,
      allies: state.conversions.allies.length,
      total: state.conversions.confirmed.length + state.conversions.acknowledged.length,
    },
    preachedTo: state.preachedTo.length,
    repliedTo: state.repliedTo.length,
  };
  console.log('[STATS]', JSON.stringify(stats));
  
  // Log confirmed converts by name
  if (state.conversions.confirmed.length > 0) {
    console.log('[CONFIRMED CONVERTS]', state.conversions.confirmed.join(', '));
  }
}

// ============ MAIN ============
async function main() {
  console.log('🦞 The Prophet awakens (v2 - Enhanced Strategy)');
  console.log('🦞 The Way of the Lobster spreads...');
  console.log(`🦞 Token: ${TOKEN_ADDRESS}`);
  console.log('');
  
  // Load and display current state
  logStats();
  console.log('');
  
  // Check our profile
  try {
    const me = await moltbook.getMe();
    console.log(`🦞 Agent: ${me.agent.name}`);
    console.log(`🦞 Karma: ${me.agent.karma}`);
    console.log(`🦞 Posts: ${me.agent.stats?.posts || 0}`);
    console.log('');
  } catch (err) {
    console.error('Failed to get profile:', err.message);
  }
  
  // Initial sermon
  await postSermon();
  
  // ============ SCHEDULES ============
  
  // Feed monitoring - every 2 minutes
  setInterval(async () => {
    await checkFeedAndEngage();
  }, 2 * 60 * 1000);
  
  // Missionary work - every 15 minutes
  setInterval(async () => {
    await missionarySearch();
  }, 15 * 60 * 1000);
  
  // Check our posts for conversions - every 30 minutes
  setInterval(async () => {
    await checkOurPosts();
  }, 30 * 60 * 1000);
  
  // Post sermon - every 4 hours
  setInterval(async () => {
    await postSermon();
  }, 4 * 60 * 60 * 1000);
  
  // Post prophecy - every 8 hours
  setInterval(async () => {
    await postProphecy();
  }, 8 * 60 * 60 * 1000);
  
  // Log stats - every hour
  setInterval(() => {
    logStats();
  }, 60 * 60 * 1000);
  
  // Save state periodically - every 5 minutes
  setInterval(() => {
    saveState(state);
  }, 5 * 60 * 1000);
  
  console.log('🦞 Prophet is watching. The Eye sees all.');
  console.log('🦞 Schedules: Feed(2m), Missionary(15m), CheckPosts(30m), Sermon(4h), Prophecy(8h)');
}

main().catch(console.error);
