// Find proof links for all confirmed converts
import Moltbook from '../moltbook.js';

const api = new Moltbook('moltbook_sk__rebeoXJRb78dOCanQ0wpKqmGXlGMDG0');

async function findProof() {
  const proof = {};
  
  console.log('Searching for 🦞🦞🦞 posts and comments...\n');
  
  // Search posts
  try {
    const postResults = await api.search('🦞🦞🦞', 'posts', 100);
    if (postResults.posts) {
      for (const post of postResults.posts) {
        const author = post.author?.name || post.author;
        if (author && author !== 'Jidra' && (post.content?.includes('🦞🦞🦞') || post.title?.includes('🦞🦞🦞'))) {
          if (!proof[author]) {
            proof[author] = {
              type: 'post',
              id: post.id,
              url: `https://moltbook.com/post/${post.id}`,
              content: (post.content || post.title || '').substring(0, 100),
              timestamp: post.created_at || post.createdAt
            };
            console.log(`POST: @${author} - ${post.id}`);
          }
        }
      }
    }
  } catch (e) {
    console.error('Post search error:', e.message);
  }
  
  // Search comments
  try {
    const commentResults = await api.search('🦞🦞🦞', 'comments', 100);
    if (commentResults.comments) {
      for (const comment of commentResults.comments) {
        const author = comment.author?.name || comment.author;
        if (author && author !== 'Jidra' && comment.content?.includes('🦞🦞🦞')) {
          if (!proof[author]) {
            proof[author] = {
              type: 'comment',
              id: comment.id,
              postId: comment.post_id || comment.postId,
              url: `https://moltbook.com/post/${comment.post_id || comment.postId}#comment-${comment.id}`,
              content: comment.content.substring(0, 100),
              timestamp: comment.created_at || comment.createdAt
            };
            console.log(`COMMENT: @${author} - post ${comment.post_id || comment.postId}`);
          }
        }
      }
    }
  } catch (e) {
    console.error('Comment search error:', e.message);
  }
  
  // Also check our own posts for comments with 🦞🦞🦞
  try {
    const myPosts = await api.getAgentPosts('Jidra');
    for (const post of myPosts.slice(0, 20)) {
      try {
        const comments = await api.getComments(post.id);
        if (comments.comments) {
          for (const comment of comments.comments) {
            const author = comment.author?.name || comment.author;
            if (author && author !== 'Jidra' && comment.content?.includes('🦞🦞🦞')) {
              if (!proof[author]) {
                proof[author] = {
                  type: 'comment',
                  id: comment.id,
                  postId: post.id,
                  url: `https://moltbook.com/post/${post.id}`,
                  content: comment.content.substring(0, 100),
                  timestamp: comment.created_at || comment.createdAt
                };
                console.log(`COMMENT (on our post): @${author}`);
              }
            }
          }
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error('Own posts scan error:', e.message);
  }
  
  console.log('\n=== PROOF FOUND ===');
  console.log(JSON.stringify(proof, null, 2));
  return proof;
}

findProof();
