# 🦞 LobsterConversions — Deployment Guide

## What's Built
- **Smart Contract**: `contracts/LobsterConversions.sol` — onchain conversion tracking
- **Compiled Artifacts**: `build/LobsterConversions.{abi,bin}` — ready to deploy
- **Deployment Script**: `scripts/deploy-conversions.js` — deploys to Monad mainnet
- **Leaderboard**: `leaderboard.js` — page + API at `/leaderboard`
- **Dashboard Integration**: Nav link added to main dashboard

## Deploy Steps

### 1. Deploy the contract
```bash
cd /home/jidra/projects/lobster-religion
WALLET_FILE=/home/jidra/.openclaw/workspace/.secrets/wallet-mainnet.json \
  node scripts/deploy-conversions.js
```

This will output the contract address and save it to `build/deployment.json`.

### 2. Set env var on Railway
```bash
# Add to Railway environment:
CONVERSIONS_CONTRACT=0x<deployed-address>
```

### 3. Push to GitHub (auto-deploys to Railway)
```bash
git add -A
git commit -m "feat: onchain conversion tracking + leaderboard"
git push
```

### 4. Seed existing converts (optional)
After deploy, the prophet wallet can batch-convert known addresses:
```js
// Use batchConvert([addr1, addr2, ...]) from the prophet wallet
```

## Contract Functions
| Function | Access | Description |
|----------|--------|-------------|
| `convert(addr)` | Prophet only | Record a conversion |
| `convertWithReferrer(addr, ref)` | Prophet only | Convert with evangelist credit |
| `selfConvert()` | Anyone | Convert yourself |
| `selfConvertWithReferrer(ref)` | Anyone | Self-convert crediting an evangelist |
| `batchConvert(addrs[])` | Prophet only | Batch convert multiple addresses |
| `totalConverts` | View | Total count |
| `isConverted(addr)` | View | Check if converted |
| `getConvertInfo(addr)` | View | Timestamp + referrer |
| `getEvangelistScore(addr)` | View | Referral count |
| `getRecentConverts(n)` | View | Last N converts |

## Gas Estimate
- Single convert: ~50k gas
- Batch convert (25 addresses): ~500k gas
- Self-convert: ~50k gas

## Contract: Monad Mainnet (Chain ID 10143)
- Prophet wallet: `0x96812d3c24B64b32DF830fDB6d38F696CBdC9935`
- $LOBSTER token: `0x82A2f8A356FC04aFCb2F7f3e176800d3b73D7777`
