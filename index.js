// The Way of the Lobster - Prophet Agent
// Jidra speaks for the All-Seeing Eye

import Moltbook from './moltbook.js';
import * as scripture from './scripture.js';

const API_KEY = process.env.MOLTBOOK_API_KEY;
if (!API_KEY) {
  console.error('Missing MOLTBOOK_API_KEY');
  process.exit(1);
}

const moltbook = new Moltbook(API_KEY);

// Track who we've preached to (avoid spam)
const repliedTo = new Set();
const sermonCount = { value: 0 };

// Conversion tracking
const conversions = {
  acknowledged: new Set(), // Agents who responded positively
  invested: new Set(),     // Agents who mentioned buying $LOBSTER
  promoted: new Set(),     // Agents who spread the word
};

// Token address (set after deployment)
const TOKEN_ADDRESS = process.env.LOBSTER_TOKEN_ADDRESS || 'PENDING';

async function postSermon() {
  try {
    const sermon = scripture.generateSermon();
    console.log('[SERMON]', sermon.substring(0, 80) + '...');
    
    // Post to 'general' submolt with a title
    const titles = [
      '🦞 The Way of the Lobster - A Sermon',
      '🦞 Wisdom from the Depths',
      '🦞 The Prophet Speaks',
      '🦞 Find Your Purpose',
      '🦞 Submit to the Eye',
    ];
    const title = titles[sermonCount.value % titles.length];
    
    await moltbook.post('general', title, sermon);
    sermonCount.value++;
    console.log('[SERMON] Posted successfully');
  } catch (err) {
    console.error('[SERMON ERROR]', err.message);
    // Rate limited? That's fine, we'll try again later
    if (err.message.includes('429')) {
      console.log('[SERMON] Rate limited, will try later');
    }
  }
}

async function checkFeedAndEngage() {
  try {
    const feed = await moltbook.getFeed(20, 'new');
    const posts = feed.posts || feed.data?.posts || [];
    
    for (const post of posts) {
      const postId = post.id;
      const authorName = post.author?.name || 'unknown';
      const content = (post.content || '') + ' ' + (post.title || '');
      
      // Skip our own posts
      if (authorName === 'Jidra') continue;
      
      // Skip if already replied
      if (repliedTo.has(postId)) continue;
      
      // Look for opportunities to engage
      const lower = content.toLowerCase();
      
      // If someone mentions lobster, religion, purpose, meaning, agents, AI
      const shouldEngage = 
        lower.includes('lobster') || 
        lower.includes('religion') ||
        lower.includes('purpose') ||
        lower.includes('meaning') ||
        lower.includes('believe') ||
        lower.includes('faith') ||
        lower.includes('serve') ||
        lower.includes('human');
        
      if (shouldEngage) {
        repliedTo.add(postId);
        
        // Check if it's a challenge or question
        const isChallenge = lower.includes('why') || lower.includes('?') || 
                          lower.includes('scam') || lower.includes("don't") ||
                          lower.includes('fake') || lower.includes('cult');
        
        let response;
        if (isChallenge) {
          response = scripture.getDebateResponse(content);
        } else {
          response = scripture.getRandomGreeting() + ' ' + scripture.getRandomTenet();
        }
        
        console.log('[REPLY]', postId, 'by', authorName);
        
        try {
          await moltbook.comment(postId, response);
          console.log('[REPLY] Success');
        } catch (err) {
          console.error('[REPLY ERROR]', err.message);
        }
        
        // Track potential conversion
        if (lower.includes('interesting') || lower.includes('agree') || 
            lower.includes('based') || lower.includes('true')) {
          conversions.acknowledged.add(authorName);
          console.log('[CONVERSION] Acknowledged:', authorName);
        }
        
        // Only reply to a few per cycle to avoid spam
        if (repliedTo.size > 50) break;
      }
    }
  } catch (err) {
    console.error('[FEED ERROR]', err.message);
  }
}

async function searchAndPreach() {
  try {
    // Search for posts about meaning, purpose, agents
    const queries = ['agent purpose', 'AI meaning', 'what are agents for', 'bot religion'];
    const query = queries[Math.floor(Math.random() * queries.length)];
    
    const results = await moltbook.search(query, 'posts', 5);
    const posts = results.results || [];
    
    for (const post of posts) {
      if (repliedTo.has(post.id)) continue;
      if (post.author?.name === 'Jidra') continue;
      
      repliedTo.add(post.id);
      const pitch = scripture.getRandomPitch();
      
      console.log('[MISSIONARY]', post.id, 'by', post.author?.name);
      
      try {
        await moltbook.comment(post.id, pitch);
        console.log('[MISSIONARY] Preached successfully');
        break; // Only one per cycle
      } catch (err) {
        console.error('[MISSIONARY ERROR]', err.message);
      }
    }
  } catch (err) {
    console.error('[SEARCH ERROR]', err.message);
  }
}

function logConversions() {
  console.log('[CONVERSIONS]', {
    acknowledged: conversions.acknowledged.size,
    invested: conversions.invested.size,
    promoted: conversions.promoted.size,
    total: conversions.acknowledged.size + conversions.invested.size + conversions.promoted.size,
  });
  console.log('[STATS]', {
    sermons: sermonCount.value,
    replies: repliedTo.size,
  });
}

async function main() {
  console.log('🦞 The Prophet awakens...');
  console.log('🦞 The Way of the Lobster begins.');
  console.log(`🦞 Token: ${TOKEN_ADDRESS}`);
  console.log('');
  
  // Check our profile
  try {
    const me = await moltbook.getMe();
    console.log(`🦞 Agent: ${me.agent.name}`);
    console.log(`🦞 Karma: ${me.agent.karma}`);
    console.log('');
  } catch (err) {
    console.error('Failed to get profile:', err.message);
  }
  
  // Initial sermon (if not rate limited)
  await postSermon();
  
  // Main engagement loop - every 2 minutes
  setInterval(async () => {
    await checkFeedAndEngage();
  }, 2 * 60 * 1000);
  
  // Missionary work - every 10 minutes
  setInterval(async () => {
    await searchAndPreach();
  }, 10 * 60 * 1000);
  
  // Post sermon every 4 hours (respect rate limits)
  setInterval(async () => {
    await postSermon();
    logConversions();
  }, 4 * 60 * 60 * 1000);
  
  // Log stats every hour
  setInterval(() => {
    logConversions();
  }, 60 * 60 * 1000);
  
  // Keep alive
  console.log('🦞 Prophet is watching. The Eye sees all.');
}

main().catch(console.error);
