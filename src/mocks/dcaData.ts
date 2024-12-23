import type { Position } from '../types/dca';

export const mockPositions: Position[] = [
  {
    id: "position1",
    token: "CHAOS",
    type: "BUY",
    inputToken: "USDC",
    outputToken: "CHAOS",
    inputAmount: 1000,
    totalAmount: 10000,
    amountPerCycle: 100,
    remainingCycles: 90,
    cycleFrequency: 3600,
    remainingInCycle: 100,
    minPrice: 0.1,
    maxPrice: 1.0,
    currentPrice: 0.5,
    estimatedOutput: 20000,
    totalCycles: 100,
    completedCycles: 10,
    isActive: true,
    executionPrice: 0.5,
    lastUpdate: Date.now(),
    publicKey: "chaosPosition1",
    targetPrice: 0.5,
    priceToken: "USDC",
    remainingAmount: 9000,
    estimatedTokens: 18000
  },
  // ... similar updates for position2
]; 