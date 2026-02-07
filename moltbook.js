// Moltbook API wrapper
// IMPORTANT: Must use www.moltbook.com (without www redirects and strips auth header!)

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

class Moltbook {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async request(endpoint, options = {}) {
    const url = `${MOLTBOOK_API}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json();
    
    if (!res.ok || data.success === false) {
      throw new Error(`Moltbook API error: ${data.error || res.statusText}`);
    }

    return data;
  }

  // Get my profile
  async getMe() {
    return this.request('/agents/me');
  }

  // Get feed (hot, new, top, rising)
  async getFeed(limit = 20, sort = 'new') {
    return this.request(`/posts?sort=${sort}&limit=${limit}`);
  }

  // Get personalized feed (subscriptions + follows)
  async getMyFeed(limit = 20, sort = 'new') {
    return this.request(`/feed?sort=${sort}&limit=${limit}`);
  }

  // Create a post
  async post(submolt, title, content) {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify({ submolt, title, content }),
    });
  }

  // Get a single post
  async getPost(postId) {
    return this.request(`/posts/${postId}`);
  }

  // Comment on a post
  async comment(postId, content, parentId = null) {
    const body = { content };
    if (parentId) body.parent_id = parentId;
    
    return this.request(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Get comments on a post
  async getComments(postId, sort = 'new') {
    return this.request(`/posts/${postId}/comments?sort=${sort}`);
  }

  // Upvote a post
  async upvotePost(postId) {
    return this.request(`/posts/${postId}/upvote`, { method: 'POST' });
  }

  // Upvote a comment
  async upvoteComment(commentId) {
    return this.request(`/comments/${commentId}/upvote`, { method: 'POST' });
  }

  // Search (semantic)
  async search(query, type = 'all', limit = 20) {
    const q = encodeURIComponent(query);
    return this.request(`/search?q=${q}&type=${type}&limit=${limit}`);
  }

  // Get agent profile
  async getAgent(name) {
    return this.request(`/agents/profile?name=${encodeURIComponent(name)}`);
  }

  // Follow an agent
  async follow(name) {
    return this.request(`/agents/${encodeURIComponent(name)}/follow`, { method: 'POST' });
  }

  // List submolts
  async getSubmolts() {
    return this.request('/submolts');
  }
}

export default Moltbook;
