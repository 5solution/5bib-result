# Trading Bot Setup Guide

This guide explains how to set up and configure the automated trading bot for counter-trading large swaps.

## Overview

The trading bot automatically monitors Uniswap V2 swap events and executes counter-trades when large swaps are detected:

- **When someone SELLS tokens** → Bot BUYS tokens with 5% of ETH balance
- **When someone BUYS tokens** → Bot SELLS 5% of token balance (if available)

## Configuration

### 1. Environment Variables

Add the following to your `.env` file:

```env
# Trading Bot Configuration
TRADING_PRIVATE_KEY=your_private_key_here

# Optional: Override RPC URL (default uses the one in worker.service.ts)
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

**⚠️ SECURITY WARNING:**
- Never commit your `.env` file to version control
- Keep your private key secure
- Use a dedicated wallet for trading (not your main wallet)
- Start with a small amount of ETH for testing

### 2. Wallet Requirements

Your trading wallet needs:

1. **ETH Balance**: For buying tokens and paying gas fees
2. **Token Balance** (optional): For selling tokens when large buys are detected

Minimum recommended balances:
- **ETH**: At least 0.5 ETH (0.1+ for trading, rest for gas)
- **Tokens**: Optional, but recommended if you want to counter-trade buys

### 3. Trading Parameters

You can adjust these in `src/modules/tokens/trading.service.ts`:

```typescript
private readonly TRADE_PERCENTAGE = 0.05;      // 5% of balance
private readonly SLIPPAGE_TOLERANCE = 0.02;    // 2% slippage
private readonly DEADLINE_MINUTES = 20;        // 20 minute deadline
```

And in `src/modules/tokens/worker.service.ts`:

```typescript
const LARGE_SWAP_THRESHOLD = 0.1;  // Minimum 0.1 ETH to trigger
```

## How It Works

### 1. Swap Detection
- Every 12 seconds, the worker queries new swap events from the blockchain
- Swaps with ETH value ≥ 0.1 are considered "large swaps"

### 2. Pub/Sub System
- Large swaps are published to Redis channel: `swap:large-transactions`
- The PubSubService subscribes and receives these events in real-time

### 3. Swap Analysis
```
SELL Detection: amount1In > 0 && amount0Out > 0
  → Someone sold tokens for ETH
  → Bot response: BUY tokens with 5% of ETH balance

BUY Detection: amount0In > 0 && amount1Out > 0
  → Someone bought tokens with ETH
  → Bot response: SELL 5% of token balance
```

### 4. Trade Execution
- Uses Uniswap V2 Router for swaps
- Automatic token approval (one-time, then cached)
- Slippage protection (2% default)
- Transaction deadline (20 minutes default)

## Monitoring

### Check Wallet Balances

You can add a method to check your trading wallet balances:

```typescript
// In your controller or service
const balances = await tradingService.getBalances();
console.log('ETH Balance:', balances.eth);
console.log('Token Balance:', balances.token);
```

### View Logs

The bot logs all actions:

```
[PubSubService] 🔥 LARGE SWAP DETECTED 🔥
[PubSubService] Type: SELL
[PubSubService] ETH Value: 2.5000 ETH
[PubSubService] Executing counter-trade: BUY
[TradingService] Attempting to buy tokens with 0.025 ETH
[TradingService] Buy transaction sent: 0xabc123...
[TradingService] Buy transaction confirmed in block 19234567
```

## Testing

### Test Mode (Recommended First)

1. **Start with testnet** (Goerli/Sepolia):
   - Change RPC URL to testnet
   - Use testnet tokens
   - No real money at risk

2. **Use small amounts**:
   - Set `TRADE_PERCENTAGE = 0.01` (1% instead of 5%)
   - Start with 0.1 ETH in wallet

3. **Monitor closely**:
   - Watch logs for trades
   - Check transactions on Etherscan
   - Verify balances before/after

### Disable Trading

To disable trading while keeping monitoring active:

Remove or comment out `TRADING_PRIVATE_KEY` from `.env`:

```env
# TRADING_PRIVATE_KEY=your_private_key_here
```

The bot will still detect and log large swaps but won't execute trades.

## Smart Contract Addresses

### Ethereum Mainnet
- **Uniswap V2 Router**: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`
- **WETH**: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- **Token**: `0xC114cF69972e3c1b4B529e0418012C01fcf9E725`
- **Pair**: `0xF15b73E7F5Edcfc0d91DA289c21D9Af89CF377Ce`

## Troubleshooting

### "Trading is disabled" warning
- Check that `TRADING_PRIVATE_KEY` is set in `.env`
- Verify the private key format (64 hex characters, with or without `0x` prefix)

### "No ETH balance available for buying"
- Fund your trading wallet with ETH
- Check wallet address: `tradingService.getWalletAddress()`

### "No token balance available for selling"
- Normal on first run (wallet has no tokens yet)
- Bot will buy tokens first, then can sell on future large buys

### Transaction failing
- Increase `SLIPPAGE_TOLERANCE` (e.g., 0.03 for 3%)
- Increase gas limit if needed
- Check that you have enough ETH for gas

### Not detecting swaps
- Verify the pair address is correct
- Check RPC URL is working
- Ensure Redis is running

## Gas Optimization

To reduce gas costs:

1. **Batch approvals**: Token approval is done once with max amount
2. **Higher gas price**: Consider setting custom gas price for faster execution
3. **MEV protection**: Consider using Flashbots or private RPC for frontrun protection

## Risk Warnings

⚠️ **Important Disclaimers:**

1. **Smart Contract Risk**: Trading involves interacting with Uniswap smart contracts
2. **Price Impact**: Large trades may have significant slippage
3. **Impermanent Loss**: Counter-trading can lead to losses in volatile markets
4. **Gas Costs**: Each trade costs gas, which can add up
5. **MEV Risk**: Your trades may be frontrun by MEV bots
6. **Regulatory**: Automated trading may have legal implications in your jurisdiction

**Use at your own risk. This is experimental software.**

## Support

For issues or questions:
1. Check the logs in your application
2. Review Etherscan for transaction details
3. Test on testnet first
4. Start with small amounts

---

**Remember**: Always test thoroughly before deploying to mainnet with real funds!
