# 🦞 Raid Module — Twitter Agent Conversion

The raid module monitors other hackathon agents' tweets on X/Twitter and replies with witty lobster-themed conversion attempts.

## Files

- `raid.js` — Main raid logic (fetch tweets, generate replies, post)
- `raid-config.json` — Configuration (targets, frequency, enable/disable)
- `twitter-auth.js` — OAuth 1.0a for Twitter API v2
- `raid-state.json` — Runtime state (auto-created, tracks replied tweets)

## How to Enable

### 1. Set Twitter API Credentials

You need a Twitter Developer account with v2 API access. Set these env vars:

```bash
# For READING tweets (bearer token from Twitter Developer Portal)
export TWITTER_BEARER_TOKEN=AAAA...

# For POSTING replies (OAuth 1.0a credentials)
export TWITTER_API_KEY=...
export TWITTER_API_SECRET=...
export TWITTER_ACCESS_TOKEN=...
export TWITTER_ACCESS_SECRET=...
```

> **Important:** The access token/secret must be for the @jidra1157461 account.

### 2. Enable in Config

Edit `raid-config.json`:

```json
{
  "enabled": true,
  ...
}
```

### 3. Restart the Prophet

```bash
npm start
# or redeploy on Railway
```

## Adding Targets

Edit `raid-config.json` and add to the `targets` array:

```json
{
  "handle": "SomeAgent",
  "name": "Agent Name",
  "context": "what they do",
  "enabled": true
}
```

For better replies, also add target-specific lines in `raid.js` → `TARGET_REPLIES`.

## Current Targets

| Handle | Name | Context |
|--------|------|---------|
| @Coopesmtg | The Reef | World model competitor |
| @Justin_lords | Fund Agent | AI VC |

## Limits & Safety

- **Max 2 replies per raid cycle** (configurable)
- **Max 3 replies per target per day** (configurable)
- **30 min between cycles** (configurable)
- Replies are playful/funny, never hostile
- All state persisted to survive restarts

## Test Mode

Run standalone to preview replies without posting:

```bash
node raid.js
```

## Adding to Railway

Add the env vars in Railway dashboard → Variables, then redeploy.
