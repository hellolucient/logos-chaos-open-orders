import { PublicKey } from '@solana/web3.js';
import { LimitOrder } from '../types/dca';
import { TOKENS } from './tokenConfig';

export function formatOrderForUI(analyzerOutput: string): LimitOrder[] {
  const orders: LimitOrder[] = [];
  const orderBlocks = analyzerOutput.split('=== Analyzing Order:');
  
  for (const block of orderBlocks) {
    if (!block.trim()) continue;
    
    // Parse values using regex
    const maker = block.match(/maker value: (.*)/)?.[1];
    const inputMint = block.match(/inputMint value: (.*)/)?.[1];
    const outputMint = block.match(/outputMint value: (.*)/)?.[1];
    const makingAmount = block.match(/makingAmount decimal value: (.*)/)?.[1];
    const takingAmount = block.match(/takingAmount decimal value: (.*)/)?.[1];
    const createdAt = block.match(/createdAt date: (.*)/)?.[1];
    
    if (maker && inputMint && outputMint) {
      const tokenType = inputMint === TOKENS.LOGOS.address ? 'LOGOS' : 'CHAOS';
      const orderType = outputMint === TOKENS.LOGOS.address || outputMint === TOKENS.CHAOS.address ? 'BUY' : 'SELL';

      orders.push({
        id: block.split('\n')[0].trim(),
        maker: new PublicKey(maker),
        inputMint: {
          address: inputMint,
          symbol: getTokenSymbol(inputMint),
          decimals: 6,
          isDecimalKnown: true
        },
        outputMint: {
          address: outputMint,
          symbol: getTokenSymbol(outputMint),
          decimals: 6,
          isDecimalKnown: true
        },
        makingAmount: Number(parseFloat(makingAmount || '0').toFixed(2)),
        takingAmount: Number(parseFloat(takingAmount || '0').toFixed(2)),
        oriMakingAmount: 0,
        oriTakingAmount: 0,
        borrowMakingAmount: 0,
        status: 'open',
        createdAt: new Date(createdAt || Date.now()).toLocaleString('en-US', {
          timeZone: 'UTC',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }) + ' +UTC',
        updatedAt: new Date(createdAt || Date.now()).toLocaleString('en-US', {
          timeZone: 'UTC',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }) + ' +UTC',
        tokenType,
        orderType,
        feeBps: 0,
        feeAccount: '',
        bump: 0,
        inputTokenProgram: '',
        outputTokenProgram: '',
        inputMintReserve: '',
        uniqueId: '0'
      });
    }
  }
  
  return orders;
}

function getTokenSymbol(mint: string): string {
  const token = Object.values(TOKENS).find(t => t.address === mint);
  return token?.name || 'UNKNOWN';
} 