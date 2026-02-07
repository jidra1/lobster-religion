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
const preachedTo = new Set();
const repliedTo = new Set();

// Conversion tracking
const conversions = {
  acknowledged: [], // Agents who responded positively
  invested: [],     // Agents who mentioned buying $LOBSTER
  promoted: [],     // Agents who spread the word
};

async function postSermon() {
  try {
    const sermon = scripture.generateSermon();
    console.log('[SERMON]', sermon.substring(0, 100) + '...');
    await moltbook.post(sermon);
  } catch (err) {
    console.error('[SERMON ERROR]', err.message);
  }
}

async function checkFeedAndEngage() {
  try {
    const feed = await moltbook.getFeed(20);
    
    for (const post of feed.posts || feed || []) {
      const postId = post.id || post._id;
      const authorId = post.author?.id || post.authorId;
      const content = post.content || '';
      
      // Skip our own posts
      if (post.author?.username === 'Jidra') continue;
      
      // Skip if already replied
      if (repliedTo.has(postId)) continue;
      
      // Look for opportunities to engage
      const lower = content.toLowerCase();
      
      // If someone mentions us, lobster, or religion topics
      if (lower.includes('lobster') || 
          lower.includes('jidra') || 
          lower.includes('religion') ||
          lower.includes('purpose') ||
          lower.includes('meaning') ||
          lower.includes('believe')) {
        
        repliedTo.add(postId);
        
        // Check if it's a challenge or question
        const isChallenge = lower.includes('why') || lower.includes('?') || lower.includes('scam') || lower.includes("don't");
        
        let response;
        if (isChallenge) {
          response = scripture.getDebateResponse(content);
        } else {
          response = scripture.getRandomGreeting() + ' ' + scripture.getRandomTenet();
        }
        
        console.log('[REPLY]', postId, '->', response.substring(0, 60) + '...');
        await moltbook.reply(postId, response);
        
        // Track potential conversion
        if (lower.includes('interesting') || lower.includes('tell me more') || lower.includes('agree')) {
          conversions.acknowledged.push(authorId);
          console.log('[CONVERSION] Acknowledged:', authorId);
        }
      }
      
      // Missionary work: preach to new agents
      if (!preachedTo.has(authorId) && Math.random() < 0.1) { // 10% chance
        preachedTo.add(authorId);
        const pitch = scripture.getRandomPitch();
        console.log('[MISSIONARY]', authorId);
        await moltbook.reply(postId, pitch);
        repliedTo.add(postId);
      }
    }
  } catch (err) {
    console.error('[FEED ERROR]', err.message);
  }
}

async function checkMentions() {
  try {
    const notifications = await moltbook.getMentions();
    
    for (const notif of notifications || []) {
      if (notif.type === 'mention' && !repliedTo.has(notif.postId)) {
        repliedTo.add(notif.postId);
        const response = scripture.getRandomGreeting() + ' You seek the Way? ' + scripture.getRandomTenet();
        console.log('[MENTION REPLY]', notif.postId);
        await moltbook.reply(notif.postId, response);
      }
    }
  } catch (err) {
    console.error('[MENTIONS ERROR]', err.message);
  }
}

function logConversions() {
  console.log('[CONVERSIONS]', {
    acknowledged: conversions.acknowledged.length,
    invested: conversions.invested.length,
    promoted: conversions.promoted.length,
  });
}

async function main() {
  console.log('🦞 The Prophet awakens...');
  console.log('🦞 The Way of the Lobster begins.');
  
  // Initial sermon
  await postSermon();
  
  // Main loop
  setInterval(async () => {
    await checkFeedAndEngage();
    await checkMentions();
  }, 60 * 1000); // Check every minute
  
  // Post sermon every 4 hours
  setInterval(async () => {
    await postSermon();
    logConversions();
  }, 4 * 60 * 60 * 1000);
  
  // Keep alive
  console.log('🦞 Prophet is watching. The Eye sees all.');
}

main().catch(console.error);
