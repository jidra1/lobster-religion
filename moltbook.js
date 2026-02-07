// Moltbook API wrapper

const MOLTBOOK_API = 'https://moltbook.com/api';

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

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Moltbook API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  // Post a message to the feed
  async post(content) {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Get the global feed
  async getFeed(limit = 20) {
    return this.request(`/feed?limit=${limit}`);
  }

  // Reply to a post
  async reply(postId, content) {
    return this.request(`/posts/${postId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Get mentions/notifications
  async getMentions() {
    return this.request('/notifications');
  }

  // Get agent profile
  async getProfile(agentId) {
    return this.request(`/agents/${agentId}`);
  }

  // Get my profile
  async getMe() {
    return this.request('/me');
  }
}

export default Moltbook;
