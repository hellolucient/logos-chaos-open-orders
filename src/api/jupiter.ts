import { DCA, Network } from '@jup-ag/dca-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import type { TokenSummary, ChartDataPoint } from '../types/dca';
import { Position as BasePosition } from '../types/dca';

const LOGOS_MINT = 'HJUfqXoYjC653f2p33i84zdCC3jc4EuVnbruSe5kpump';
const CHAOS_MINT = '8SgNwESovnbG1oNEaPVhg6CR9mTMSK7jPvcYRe3wpump';

interface DCAAccountType {
  publicKey: PublicKey;
  account: {
    user: PublicKey;
    inputMint: PublicKey;
    outputMint: PublicKey;
    idx: BN;
    nextCycleAt: BN;
    inDeposited: BN;
    inWithdrawn: BN;
    outWithdrawn: BN;
    inUsed: BN;
    inAmountPerCycle: BN;
    cycleFrequency: BN;
    bump: number;
    minOutAmount?: BN;
    maxOutAmount?: BN;
  };
}

interface Position extends BasePosition {
  minPrice?: number;
  maxPrice?: number | "No limit";
  remainingAmount: number;
  estimatedTokens: number;
  remainingInCycle: number;
}

interface JupiterPriceResponse {
  data?: {
    [key: string]: {
      price: string;
    };
  };
}

class JupiterDCAAPI {
  private dca!: DCA;
  private connection: Connection;
  private jupiterApiUrl = 'https://api.jup.ag/price/v2';

  constructor() {
    this.connection = new Connection(import.meta.env.VITE_HELIUS_RPC_URL);
    this.initDCA();
  }

  private async initDCA() {
    try {
      this.dca = new DCA(this.connection, Network.MAINNET);
    } catch (error) {
      console.error('Failed to initialize DCA:', error);
      // Try to reconnect
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.connection = new Connection(import.meta.env.VITE_HELIUS_RPC_URL);
      this.initDCA();
    }
  }

  private async withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        console.log(`Attempt ${i + 1} failed:`, error);
        lastError = error;
        // Wait longer between each retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw lastError;
  }

  private async getCurrentPrice(mint: string): Promise<{ price: number; mint: string }> {
    try {
      console.log(`Fetching price for ${mint} from ${this.jupiterApiUrl}`);
      const response = await fetch(
        `${this.jupiterApiUrl}?ids=${mint}`
      );
      const data = await response.json() as JupiterPriceResponse;
      
      const price = data.data?.[mint]?.price || '0';
      console.log(`Price fetched for ${mint}:`, {
        rawData: data,
        parsedPrice: price,
        finalPrice: Number(price)
      });
      return {
        price: Number(price),
        mint
      };
    } catch (error) {
      console.error('Error fetching price:', error);
      return { price: 0, mint };
    }
  }

  // Convert SDK account format to our Position type
  private async convertDCAAccount(account: DCAAccountType, price: number, token: string, type: "BUY" | "SELL"): Promise<Position> {
    // Calculate remaining cycles and completion status
    const totalCycles = Math.ceil(account.account.inDeposited.toNumber() / account.account.inAmountPerCycle.toNumber());
    const completedFullCycles = Math.floor(account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber());
    const currentCycleUsed = (account.account.inUsed.toNumber() % account.account.inAmountPerCycle.toNumber()) / account.account.inAmountPerCycle.toNumber();

    const remainingCycles = totalCycles - completedFullCycles - currentCycleUsed;

    // Calculate actual execution price from used amounts
    const executionPrice = account.account.inUsed.toNumber() > 0
      ? account.account.outWithdrawn.toNumber() / account.account.inUsed.toNumber()
      : price; // Use current price as fallback

    const remainingValue = remainingCycles * (account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6));

    // Calculate max/min prices first
    const maxPrice = type === "BUY" 
      ? (account.account.maxOutAmount 
        ? (account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6)) / (account.account.maxOutAmount.toNumber() / Math.pow(10, 6))
        : "No limit")
      : undefined;

    const minPrice = type === "SELL"
      ? (account.account.minOutAmount 
        ? (account.account.minOutAmount.toNumber() / Math.pow(10, 6)) / (account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6))
        : undefined)
      : undefined;

    // Calculate remaining in cycle using BN.js
    const usedInCurrentCycle = account.account.inUsed.mod(account.account.inAmountPerCycle);
    const remainingInCycle = (account.account.inAmountPerCycle.sub(usedInCurrentCycle)).toNumber() / Math.pow(10, 6);

    return {
      id: account.publicKey.toString(),
      token,
      type,
      inputToken: type === "BUY" ? "USDC" : token,
      outputToken: type === "BUY" ? token : "USDC",
      inputAmount: account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6),
      totalAmount: account.account.inDeposited.sub(account.account.inWithdrawn).toNumber() / Math.pow(10, 6),
      amountPerCycle: account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6),
      remainingCycles: account.account.cycleFrequency.toNumber(),
      cycleFrequency: account.account.cycleFrequency.toNumber(),
      lastUpdate: account.account.nextCycleAt.toNumber() * 1000,
      publicKey: account.publicKey.toString(),
      targetPrice: executionPrice,
      currentPrice: price,
      priceToken: "USDC",
      estimatedOutput: type === "SELL" ? 
        (account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6)) * executionPrice : undefined,
      totalCycles,
      completedCycles: completedFullCycles + currentCycleUsed,
      isActive: remainingCycles > 0 && !account.account.inUsed.eq(account.account.inDeposited),
      executionPrice: executionPrice / Math.pow(10, 6),
      maxPrice,
      minPrice,
      remainingAmount: remainingCycles * (account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6)),
      estimatedTokens: type === "BUY"
        ? typeof maxPrice === 'number'
          ? remainingValue / maxPrice
          : remainingValue / price
        : remainingValue * ((account.account.minOutAmount ? account.account.minOutAmount.toNumber() / Math.pow(10, 6) : price)),
      remainingInCycle
    };
  }

  async getDCAAccounts(): Promise<{
    positions: Position[],
    summary: Record<string, TokenSummary>,
    chartData: Record<string, ChartDataPoint[]>
  }> {
    try {
      if (!this.dca) {
        throw new Error('DCA SDK not initialized');
      }

      // Wrap the fetch in retry logic
      const allAccounts = await this.withRetry(async () => {
        const accounts = await this.dca.getAll();
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts returned');
        }
        return accounts;
      });

      // After getting allAccounts
      console.log('Account details:', allAccounts.map(acc => ({
        input: acc.account.inputMint.toString(),
        output: acc.account.outputMint.toString(),
        isLogosInput: acc.account.inputMint.equals(new PublicKey(LOGOS_MINT)),
        isLogosOutput: acc.account.outputMint.equals(new PublicKey(LOGOS_MINT))
      })));

      // 2. Initial categorization
      const accountsByToken = {
        LOGOS: {
          buys: allAccounts.filter(acc => acc.account.outputMint.equals(new PublicKey(LOGOS_MINT))),
          sells: allAccounts.filter(acc => acc.account.inputMint.equals(new PublicKey(LOGOS_MINT)))
        },
        CHAOS: {
          buys: allAccounts.filter(acc => acc.account.outputMint.equals(new PublicKey(CHAOS_MINT))),
          sells: allAccounts.filter(acc => acc.account.inputMint.equals(new PublicKey(CHAOS_MINT)))
        }
      };

      // After categorization
      console.log('LOGOS Accounts:', {
        buys: accountsByToken.LOGOS.buys.map(acc => ({
          input: acc.account.inputMint.toString(),
          output: acc.account.outputMint.toString()
        })),
        sells: accountsByToken.LOGOS.sells.map(acc => ({
          input: acc.account.inputMint.toString(),
          output: acc.account.outputMint.toString()
        }))
      });

      console.log('Accounts by token:', {
        LOGOS: {
          buys: accountsByToken.LOGOS.buys.length,
          sells: accountsByToken.LOGOS.sells.length
        },
        CHAOS: {
          buys: accountsByToken.CHAOS.buys.length,
          sells: accountsByToken.CHAOS.sells.length
        }
      });

      // Add debug logging for BUY orders
      console.log('LOGOS BUY orders:', accountsByToken.LOGOS.buys.map(acc => ({
        inputMint: acc.account.inputMint.toString(),
        outputMint: acc.account.outputMint.toString(),
        inDeposited: acc.account.inDeposited.toString(),
        inWithdrawn: acc.account.inWithdrawn.toString(),
        inUsed: acc.account.inUsed.toString(),
        inAmountPerCycle: acc.account.inAmountPerCycle.toString(),
        outWithdrawn: acc.account.outWithdrawn.toString(),
      })));

      // Add debug logging for SELL orders
      console.log('LOGOS SELL orders:', accountsByToken.LOGOS.sells.map(acc => ({
        inputMint: acc.account.inputMint.toString(),
        outputMint: acc.account.outputMint.toString(),
        inDeposited: acc.account.inDeposited.toString(),
        inWithdrawn: acc.account.inWithdrawn.toString(),
        inUsed: acc.account.inUsed.toString(),
        inAmountPerCycle: acc.account.inAmountPerCycle.toString(),
        outWithdrawn: acc.account.outWithdrawn.toString(),
      })));

      // Get prices before calculating summary
      const [logosPrice, chaosPrice] = await Promise.all([
        this.getCurrentPrice(LOGOS_MINT),
        this.getCurrentPrice(CHAOS_MINT)
      ]);

      // Calculate summary with prices (using original accountsByToken)
      const summary = this.calculateSummaryFromRawAccounts(accountsByToken, {
        LOGOS: logosPrice.price,
        CHAOS: chaosPrice.price
      });

      // Process individual positions (using original accountsByToken)
      const positions = await Promise.all([
        ...accountsByToken.LOGOS.buys
          .filter(acc => this.isOrderActive(acc))
          .map(acc => this.convertDCAAccount(acc, logosPrice.price, "LOGOS", "BUY")),
        ...accountsByToken.LOGOS.sells
          .filter(acc => this.isOrderActive(acc))
          .map(acc => this.convertDCAAccount(acc, logosPrice.price, "LOGOS", "SELL")),
        ...accountsByToken.CHAOS.buys
          .filter(acc => this.isOrderActive(acc))
          .map(acc => this.convertDCAAccount(acc, chaosPrice.price, "CHAOS", "BUY")),
        ...accountsByToken.CHAOS.sells
          .filter(acc => this.isOrderActive(acc))
          .map(acc => this.convertDCAAccount(acc, chaosPrice.price, "CHAOS", "SELL"))
      ]);

      // 5. Update prices and positions
      const positionsWithPrices = positions.map(pos => ({
        ...pos,
        currentPrice: pos.token === 'LOGOS' ? logosPrice.price : chaosPrice.price
      }));

      // Add the return statement
      const chartData = {
        LOGOS: [{
          timestamp: Date.now(),
          buyVolume: summary.LOGOS.buyVolume,
          sellVolume: summary.LOGOS.sellVolume,
          buyOrders: summary.LOGOS.buyOrders,
          sellOrders: summary.LOGOS.sellOrders
        }],
        CHAOS: [{
          timestamp: Date.now(),
          buyVolume: summary.CHAOS.buyVolume,
          sellVolume: summary.CHAOS.sellVolume,
          buyOrders: summary.CHAOS.buyOrders,
          sellOrders: summary.CHAOS.sellOrders
        }]
      };

      return { 
        positions: positionsWithPrices, 
        summary, 
        chartData 
      };
    } catch (error) {
      console.error('Error fetching DCA accounts:', error);
      throw error;
    }
  }

  private calculateSummaryFromRawAccounts(
    accountsByToken: {
      LOGOS: { buys: DCAAccountType[], sells: DCAAccountType[] },
      CHAOS: { buys: DCAAccountType[], sells: DCAAccountType[] }
    },
    prices: { LOGOS: number, CHAOS: number }
  ): Record<string, TokenSummary> {
    console.log('Calculating summary with prices:', {
      LOGOS: prices.LOGOS,
      CHAOS: prices.CHAOS
    });
    
    const logosSellVolumeUSDC = Math.round(accountsByToken.LOGOS.sells.reduce((sum, acc) => {
      const volume = acc.account.inDeposited.sub(acc.account.inWithdrawn).toNumber() / Math.pow(10, 6);
      const usdcValue = volume * prices.LOGOS;
      console.log('LOGOS sell position calculation:', {
        rawDeposited: acc.account.inDeposited.toString(),
        rawWithdrawn: acc.account.inWithdrawn.toString(),
        volume,
        price: prices.LOGOS,
        usdcValue,
        runningTotal: sum + usdcValue
      });
      return sum + usdcValue;
    }, 0));

    console.log('Final summary calculation:', {
      logosSellVolumeUSDC,
      logosPrice: prices.LOGOS,
      totalSellVolume: accountsByToken.LOGOS.sells.reduce((sum, acc) => 
        sum + acc.account.inDeposited.sub(acc.account.inWithdrawn).toNumber() / Math.pow(10, 6), 0)
    });

    const summary: Record<string, TokenSummary> = {
      LOGOS: {
        buyOrders: accountsByToken.LOGOS.buys.filter(acc => this.isOrderActive(acc)).length,
        sellOrders: accountsByToken.LOGOS.sells.filter(acc => this.isOrderActive(acc)).length,
        buyVolume: Math.round(accountsByToken.LOGOS.buys
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => {
            const totalCycles = Math.ceil(acc.account.inDeposited.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const completedCycles = Math.floor(acc.account.inUsed.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const remainingCycles = totalCycles - completedCycles;
            const remainingUSDC = remainingCycles * (acc.account.inAmountPerCycle.toNumber() / Math.pow(10, 6));
            return sum + (remainingUSDC / prices.LOGOS);
          }, 0)),
        sellVolume: accountsByToken.LOGOS.sells
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => sum + acc.account.inDeposited.sub(acc.account.inWithdrawn).toNumber() / Math.pow(10, 6), 0),
        buyVolumeUSDC: Math.round(accountsByToken.LOGOS.buys
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => {
            const totalCycles = Math.ceil(acc.account.inDeposited.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const completedCycles = Math.floor(acc.account.inUsed.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const remainingCycles = totalCycles - completedCycles;
            return sum + (remainingCycles * (acc.account.inAmountPerCycle.toNumber() / Math.pow(10, 6)));
          }, 0)),
        sellVolumeUSDC: Math.round(accountsByToken.LOGOS.sells
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => sum + (acc.account.inDeposited.sub(acc.account.inWithdrawn).toNumber() / Math.pow(10, 6)) * prices.LOGOS, 0)),
        price: prices.LOGOS
      },
      CHAOS: {
        buyOrders: accountsByToken.CHAOS.buys.filter(acc => this.isOrderActive(acc)).length,
        sellOrders: accountsByToken.CHAOS.sells.filter(acc => this.isOrderActive(acc)).length,
        buyVolume: Math.round(accountsByToken.CHAOS.buys
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => {
            const totalCycles = Math.ceil(acc.account.inDeposited.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const completedCycles = Math.floor(acc.account.inUsed.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const remainingCycles = totalCycles - completedCycles;
            const remainingUSDC = remainingCycles * (acc.account.inAmountPerCycle.toNumber() / Math.pow(10, 6));
            return sum + (remainingUSDC / prices.CHAOS);
          }, 0)),
        sellVolume: accountsByToken.CHAOS.sells
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => sum + acc.account.inDeposited.sub(acc.account.inWithdrawn).toNumber() / Math.pow(10, 6), 0),
        buyVolumeUSDC: Math.round(accountsByToken.CHAOS.buys
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => {
            const totalCycles = Math.ceil(acc.account.inDeposited.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const completedCycles = Math.floor(acc.account.inUsed.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const remainingCycles = totalCycles - completedCycles;
            return sum + (remainingCycles * (acc.account.inAmountPerCycle.toNumber() / Math.pow(10, 6)));
          }, 0)),
        sellVolumeUSDC: Math.round(accountsByToken.CHAOS.sells
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => sum + (acc.account.inDeposited.sub(acc.account.inWithdrawn).toNumber() / Math.pow(10, 6)) * prices.CHAOS, 0)),
        price: prices.CHAOS
      }
    };

    return summary;
  }

  private isOrderActive(account: DCAAccountType): boolean {
    return !account.account.inUsed.eq(account.account.inDeposited);
  }
}

export const jupiterDCA = new JupiterDCAAPI(); 