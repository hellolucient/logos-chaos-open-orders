import { PublicKey } from '@solana/web3.js';

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  isDecimalKnown: boolean;
}

export interface DCAOrder {
  id: string;
  owner: PublicKey;
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: number;
  frequency: 'hourly' | 'daily' | 'weekly';
  nextExecutionTime: Date;
  totalExecutions: number;
  remainingExecutions: number;
  status: 'active' | 'completed' | 'cancelled';
  averagePrice?: number;
}

export interface LimitOrder {
  id: string;
  maker: PublicKey;
  inputMint: TokenInfo;
  outputMint: TokenInfo;
  makingAmount: number;
  takingAmount: number;
  oriMakingAmount: number;
  oriTakingAmount: number;
  borrowMakingAmount: number;
  status: 'open' | 'filled' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  expiredAt?: string;
  tokenType: 'LOGOS' | 'CHAOS';
  orderType: 'BUY' | 'SELL';
  feeBps: number;
  feeAccount: string;
  bump: number;
  inputTokenProgram: string;
  outputTokenProgram: string;
  inputMintReserve: string;
  uniqueId: string;
}

export interface DCASummary {
  totalOrders: number;
  activeOrders: number;
  totalVolume: number;
  averageOrderSize: number;
  activeLimitOrders: number;
  totalLimitOrders: number;
}

export interface ChartDataPoint {
  timestamp: number;
  buyVolume: number;
  sellVolume: number;
  buyOrders: number;
  sellOrders: number;
  limitOrderVolume?: number;
  dcaVolume?: number;
  averagePrice?: number;
}

export interface TokenSummary {
  buyOrders: number;
  sellOrders: number;
  buyVolume: number;
  sellVolume: number;
  buyVolumeUSDC: number;
  sellVolumeUSDC: number;
  price: number;
  limitOrders?: number;
  limitOrderVolume?: number;
  limitVolumeUSDC?: number;
}

export type Position = {
  id: string;
  token: string;
  type: "BUY" | "SELL";
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  totalAmount: number;
  amountPerCycle: number;
  remainingCycles: number;
  cycleFrequency: number;
  lastUpdate: number;
  publicKey: string;
  targetPrice: number;
  currentPrice: number;
  priceToken: string;
  estimatedOutput?: number;
  totalCycles: number;
  completedCycles: number;
  isActive: boolean;
  executionPrice: number;
  maxPrice?: number | "No limit";
  minPrice?: number;
  remainingAmount: number;
  estimatedTokens: number;
  remainingInCycle: number;
};

export type Order = {
  type: 'dca' | 'limit';
  order: DCAOrder | LimitOrder;
}; 