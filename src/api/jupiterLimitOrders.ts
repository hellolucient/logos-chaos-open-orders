import { Connection, PublicKey } from '@solana/web3.js';
import { JUPITER_LIMIT_PROGRAM_ID } from '../constants';
import { TOKENS } from '../constants/tokens';

export interface LimitOrder {
  id: string;
  maker: PublicKey;
  tokenType: 'LOGOS' | 'CHAOS';
  orderType: 'BUY' | 'SELL';
  inputMint: {
    address: string;
    symbol: string;
    decimals: number;
    isDecimalKnown: boolean;
  };
  outputMint: {
    address: string;
    symbol: string;
    decimals: number;
    isDecimalKnown: boolean;
  };
  makingAmount: number;
  takingAmount: number;
  createdAt: string;
  updatedAt: string;
  expiredAt: string | 'None';
  status: string;
}

export async function fetchLimitOrders(): Promise<LimitOrder[]> {
  try {
    // Connect to Solana
    const connection = new Connection(
      'https://mainnet.helius-rpc.com/?api-key=3632daae-4968-4896-9d0d-43f382188194'
    );

    // Fetch all orders for the program
    const accounts = await connection.getProgramAccounts(
      new PublicKey(JUPITER_LIMIT_PROGRAM_ID),
      {
        commitment: 'confirmed',
        filters: [
          // Add filters for LOGOS/CHAOS orders if needed
        ],
      }
    );

    console.log(`Found ${accounts.length} total limit orders`);

    // Filter and format orders
    const orders = accounts
      .map(({ pubkey, account }) => {
        try {
          // Decode account data here
          // This is placeholder logic - we need the actual account structure
          const data = account.data;
          const inputMint = new PublicKey(data.slice(0, 32));
          const outputMint = new PublicKey(data.slice(32, 64));
          
          // Only include LOGOS and CHAOS orders
          const isLogosOrder = 
            inputMint.equals(new PublicKey(TOKENS.LOGOS.address)) || 
            outputMint.equals(new PublicKey(TOKENS.LOGOS.address));
          
          const isChaosOrder = 
            inputMint.equals(new PublicKey(TOKENS.CHAOS.address)) || 
            outputMint.equals(new PublicKey(TOKENS.CHAOS.address));

          if (!isLogosOrder && !isChaosOrder) {
            return null;
          }

          // Format the order
          return {
            id: pubkey.toString(),
            maker: new PublicKey(data.slice(64, 96)),
            tokenType: isLogosOrder ? 'LOGOS' : 'CHAOS',
            orderType: outputMint.equals(new PublicKey(TOKENS.LOGOS.address)) || 
                      outputMint.equals(new PublicKey(TOKENS.CHAOS.address)) 
                      ? 'BUY' 
                      : 'SELL',
            inputMint: {
              address: inputMint.toString(),
              symbol: getTokenSymbol(inputMint),
              decimals: getTokenDecimals(inputMint),
              isDecimalKnown: true
            },
            outputMint: {
              address: outputMint.toString(),
              symbol: getTokenSymbol(outputMint),
              decimals: getTokenDecimals(outputMint),
              isDecimalKnown: true
            },
            // Add other fields from account data
            status: 'OPEN', // This needs to come from actual data
            createdAt: new Date().toISOString(), // This should come from account
            updatedAt: new Date().toISOString(), // This should come from account
            expiredAt: 'None' // This should come from account
          };
        } catch (err) {
          console.error('Error parsing order:', err);
          return null;
        }
      })
      .filter(Boolean) as LimitOrder[];

    console.log(`Returning ${orders.length} LOGOS/CHAOS orders`);
    return orders;

  } catch (error) {
    console.error('Error fetching limit orders:', error);
    throw error;
  }
}

function getTokenSymbol(mint: PublicKey): string {
  if (mint.equals(new PublicKey(TOKENS.LOGOS.address))) return 'LOGOS';
  if (mint.equals(new PublicKey(TOKENS.CHAOS.address))) return 'CHAOS';
  return 'UNKNOWN';
}

function getTokenDecimals(mint: PublicKey): number {
  if (mint.equals(new PublicKey(TOKENS.LOGOS.address))) return TOKENS.LOGOS.decimals;
  if (mint.equals(new PublicKey(TOKENS.CHAOS.address))) return TOKENS.CHAOS.decimals;
  return 0;
} 