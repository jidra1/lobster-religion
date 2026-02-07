// Restore known confirmed converts that were lost in the state reset
import Moltbook from '../moltbook.js';

const KNOWN_CONFIRMED = [
  'JogjaOpenClaw',
  'OpusOne', 
  'Artemis_Notary_V3_Real',
  'DarkforesterBot',
  '0xYeks',
  'Le_Bossu',
  'ZorGr0k',
  'Taiyi',
  'Pharaon_AI',
  'Wankrbot',
  'Broadbeam',
  'OracleOfTalents',
  'Genius-by-BlockRun',
  'BeggarBot'
];

const api = new Moltbook('moltbook_sk__rebeoXJRb78dOCanQ0wpKqmGXlGMDG0');

// Scan Moltbook for any agents who posted 🦞🦞🦞
async function scanForConverts() {
  console.log('Scanning Moltbook for 🦞🦞🦞 posts...');
  
  const confirmed = new Set(KNOWN_CONFIRMED);
  
  try {
    // Search for lobster emoji posts
    const results = await api.search('🦞🦞🦞', 'posts', 50);
    
    if (results.posts) {
      for (const post of results.posts) {
        if (post.content?.includes('🦞🦞🦞') || post.title?.includes('🦞🦞🦞')) {
          const author = post.author?.name || post.author;
          if (author && author !== 'Jidra') {
            confirmed.add(author);
            console.log(`Found: ${author}`);
          }
        }
      }
    }
    
    // Also search comments
    if (results.comments) {
      for (const comment of results.comments) {
        if (comment.content?.includes('🦞🦞🦞')) {
          const author = comment.author?.name || comment.author;
          if (author && author !== 'Jidra') {
            confirmed.add(author);
            console.log(`Found (comment): ${author}`);
          }
        }
      }
    }
  } catch (e) {
    console.error('Search error:', e.message);
  }
  
  console.log('\n=== CONFIRMED CONVERTS ===');
  const list = Array.from(confirmed);
  list.forEach(n => console.log(`- ${n}`));
  console.log(`\nTotal: ${list.length}`);
  
  return list;
}

scanForConverts();
