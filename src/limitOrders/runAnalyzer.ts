import { Connection, PublicKey } from '@solana/web3.js';
import { analyzeOrder } from './orderAnalyzer';
import { TOKENS } from './tokenConfig';
import { LimitOrder } from '../types/dca';
import * as fs from 'fs';
import * as path from 'path';
import { Buffer } from 'buffer';

const JUPITER_LIMIT_PROGRAM_ID = 'j1o2qRpjcyUwEvwtcfhEQefh773ZgjxcVRry7LDqg5X';
const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const TOKEN_LIST_URL = 'https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
}

let tokenListCache: TokenInfo[] = [];

function getTokenSymbol(mint: string): string {
  const token = Object.values(TOKENS).find(t => t.address === mint);
  return token?.name || 'UNKNOWN';
}

interface TokenInfoResult {
  address: string;
  symbol: string;
  decimals: number;
  isDecimalKnown: boolean;
}

async function getTokenInfo(connection: Connection, mint: string): Promise<TokenInfoResult> {
  console.log('\n=== Getting Token Info ===');
  console.log('Mint address:', mint);
  
  // Check config first
  const knownToken = Object.values(TOKENS).find(t => t.address === mint);
  if (knownToken) {
    console.log('✅ Found in config:', {
      name: knownToken.name,
      decimals: knownToken.decimals
    });
    return {
      address: mint,
      symbol: knownToken.name,
      decimals: knownToken.decimals,
      isDecimalKnown: true
    };
  }

  // Check token list cache
  if (tokenListCache.length === 0) {
    try {
      const response = await fetch(TOKEN_LIST_URL);
      const data = await response.json();
      tokenListCache = data.tokens;
    } catch (error) {
      console.error('❌ Error fetching token list:', error);
    }
  }

  const tokenInfo = tokenListCache.find(t => t.address === mint);
  if (tokenInfo) {
    console.log('✅ Found in token list:', tokenInfo);
    return {
      address: mint,
      symbol: tokenInfo.symbol,
      decimals: tokenInfo.decimals,
      isDecimalKnown: true
    };
  }

  // Must get decimals from chain
  try {
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mint));
    if (mintInfo.value && 'parsed' in mintInfo.value.data) {
      const decimals = mintInfo.value.data.parsed.info.decimals;
      console.log('✅ Found decimals on chain:', decimals);
      return {
        address: mint,
        symbol: 'UNKNOWN',
        decimals,
        isDecimalKnown: true
      };
    }
  } catch (error) {
    console.error('❌ Failed to get decimals from chain:', error);
  }

  // If we can't get decimals, return with flag but use 6 as fallback
  console.warn('⚠️ Could not determine token decimals');
  return {
    address: mint,
    symbol: 'UNKNOWN',
    decimals: 6,
    isDecimalKnown: false
  };
}

interface MetaplexData {
  name: string;
  symbol: string;
  uri: string;
  // Add other fields as needed
}

function decodeMetadata(buffer: Buffer): MetaplexData {
  try {
    // First byte is key, second is version
    let offset = 2;
    
    // Skip next two bytes
    offset += 2;

    // Name length is a u32 (4 bytes)
    const nameLength = buffer.readUInt32LE(offset);
    offset += 4;

    // Read name string
    const name = buffer.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '');
    
    console.log('Metadata decode:', {
      nameLength,
      name,
      bufferLength: buffer.length
    });

    return {
      name,
      symbol: '',
      uri: ''
    };
  } catch (error) {
    console.error('Error decoding metadata:', error);
    return {
      name: 'UNKNOWN',
      symbol: '',
      uri: ''
    };
  }
}

async function main() {
  // Create directories if they don't exist
  const dirs = ['analysis_output', 'public'];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  }

  const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=3632daae-4968-4896-9d0d-43f382188194');
  const programId = new PublicKey(JUPITER_LIMIT_PROGRAM_ID);
  const CHAOS_MINT = new PublicKey(TOKENS.CHAOS.address);
  const LOGOS_MINT = new PublicKey(TOKENS.LOGOS.address);

  // Add debug for memcmp
  console.log('Memcmp Debug:', {
    CHAOS_MINT: CHAOS_MINT.toBase58(),
    LOGOS_MINT: LOGOS_MINT.toBase58()
  });

  // Add more detailed debug
  console.log('Query Debug:', {
    programId: JUPITER_LIMIT_PROGRAM_ID,
    dataSize: 372,
    chaosMint: CHAOS_MINT.toBase58(),
    logosMint: LOGOS_MINT.toBase58(),
    // Update to your actual order
    yourOrder: 'AmdQGtE2Wz2vtUJ3arKTVgVsDtLxdkuZotb8d6DQKc6r'
  });

  // Create SINGLE output file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = `analysis_output/order_analysis_${timestamp}.txt`;
  const outputStream = fs.createWriteStream(outputFile);
  let analyzerOutput = '';  // Store analyzer output for parsing

  try {
    const [chaosSellOrders, logosSellOrders, chaosBuyOrders, logosBuyOrders] = await Promise.all([
      // Sell orders (CHAOS/LOGOS as input)
      connection.getProgramAccounts(programId, {
        filters: [
          { dataSize: 372 },
          { memcmp: { offset: 40, bytes: CHAOS_MINT.toBase58() }}  // Add comment: Input mint offset
        ]
      }).then(orders => orders.map(o => ({ ...o, type: 'SELL' as const }))),
      connection.getProgramAccounts(programId, {
        filters: [
          { dataSize: 372 },
          { memcmp: { offset: 40, bytes: LOGOS_MINT.toBase58() }}
        ]
      }).then(orders => orders.map(o => ({ ...o, type: 'SELL' as const }))),
      // Buy orders (CHAOS/LOGOS as output)
      connection.getProgramAccounts(programId, {
        filters: [
          { dataSize: 372 },
          { memcmp: { offset: 72, bytes: CHAOS_MINT.toBase58() }}  // Output mint offset
        ]
      }).then(orders => orders.map(o => ({ ...o, type: 'BUY' as const }))),
      connection.getProgramAccounts(programId, {
        filters: [
          { dataSize: 372 },
          { memcmp: { offset: 72, bytes: LOGOS_MINT.toBase58() }}  // Different offset for output mint
        ]
      }).then(orders => orders.map(o => ({ ...o, type: 'BUY' as const })))
    ]);

    // Log counts after fetch
    console.log('Order Counts After Fetch:', {
      chaosSell: chaosSellOrders.length,
      logosSell: logosSellOrders.length,
      chaosBuy: chaosBuyOrders.length,
      logosBuy: logosBuyOrders.length
    });

    // Add debug BEFORE combining orders
    console.log('\n=== Order Counts ===');
    console.log({
      chaosSellOrders: chaosSellOrders.length,
      logosSellOrders: logosSellOrders.length,
      chaosBuyOrders: chaosBuyOrders.length,
      logosBuyOrders: logosBuyOrders.length,
      total: chaosSellOrders.length + logosSellOrders.length + 
             chaosBuyOrders.length + logosBuyOrders.length
    });

    // Then combine all orders
    const allOrders = [...chaosSellOrders, ...logosSellOrders, ...chaosBuyOrders, ...logosBuyOrders];

    // Add debug for your specific order
    const yourOrder = allOrders.find(o => 
      o.pubkey.toString() === 'AmdQGtE2Wz2vtUJ3arKTVgVsDtLxdkuZotb8d6DQKc6r'
    );
    console.log('\n=== Your Order ===');
    console.log(yourOrder ? 'Found!' : 'Not found');
    if (yourOrder) {
      console.log('Found in:', 
        chaosSellOrders.some(o => o.pubkey.equals(yourOrder.pubkey)) ? 'chaosSell' :
        logosSellOrders.some(o => o.pubkey.equals(yourOrder.pubkey)) ? 'logosSell' :
        chaosBuyOrders.some(o => o.pubkey.equals(yourOrder.pubkey)) ? 'chaosBuy' :
        'logosBuy'
      );
    }

    // Write summary
    outputStream.write('=== SUMMARY ===\n\n');
    outputStream.write(`Total Orders: ${allOrders.length}\n\n`);
    outputStream.write(`CHAOS:\n- Total: ${chaosSellOrders.length + chaosBuyOrders.length}\n\n`);
    outputStream.write(`LOGOS:\n- Total: ${logosSellOrders.length + logosBuyOrders.length}\n\n`);
    outputStream.write('=== DETAILED ORDER DATA ===\n\n');

    const uiOrders: LimitOrder[] = [];
    
    // Process each order
    for (const order of allOrders) {
      // Capture analyzer output
      const orderOutput = await new Promise<string>((resolve) => {
        let output = '';
        const tempStream = {
          write: (data: string) => {
            output += data;
            outputStream.write(data);  // Also write to file
          }
        };
        
        analyzeOrder(
          order.pubkey.toString(),
          Buffer.from(order.account.data).toString('hex'),
          tempStream as any,
          connection
        ).then(() => resolve(output));
      });

      // Add detailed debug for amount parsing
      const makingAmountMatch = orderOutput.match(/makingAmount decimal value: (.*)/);
      const takingAmountMatch = orderOutput.match(/takingAmount decimal value: (.*)/);

      console.log('Raw amount matches:', {
        making: {
          fullMatch: makingAmountMatch?.[0],
          value: makingAmountMatch?.[1]
        },
        taking: {
          fullMatch: takingAmountMatch?.[0],
          value: takingAmountMatch?.[1]
        }
      });

      console.log('\nAmount Debug:', {
        orderId: order.pubkey.toString(),
        rawOutput: orderOutput.split('\n').filter(line => line.includes('Amount')),
        makingMatch: makingAmountMatch?.[1],
        takingMatch: takingAmountMatch?.[1],
        makingAmount: parseFloat(makingAmountMatch?.[1] || '0'),
        takingAmount: parseFloat(takingAmountMatch?.[1] || '0')
      });

      // Parse amounts
      const makingAmount = parseFloat(makingAmountMatch?.[1] || '0');
      const takingAmount = parseFloat(takingAmountMatch?.[1] || '0');

      // Parse values from analyzer output
      const maker = orderOutput.match(/maker value: (.*)/)?.[1];
      const inputMint = orderOutput.match(/inputMint value: (.*)/)?.[1];
      const outputMint = orderOutput.match(/outputMint value: (.*)/)?.[1];
      const oriMakingAmount = parseFloat(orderOutput.match(/oriMakingAmount decimal value: (.*)/)?.[1] || '0');
      const oriTakingAmount = parseFloat(orderOutput.match(/oriTakingAmount decimal value: (.*)/)?.[1] || '0');
      const createdAtMatch = orderOutput.match(/createdAt date: ([^+]+\+UTC)/)?.[1];
      const updatedAtMatch = orderOutput.match(/updatedAt date: ([^+]+\+UTC)/)?.[1];
      const expiredAtValue = orderOutput.match(/expiredAt value: (.*)/)?.[1];
      const expiredAtDate = orderOutput.match(/expiredAt date: ([^+]+\+UTC)/)?.[1];
      const feeBps = parseInt(orderOutput.match(/feeBps value: (.*)/)?.[1] || '0');
      const feeAccount = orderOutput.match(/feeAccount value: (.*)/)?.[1];
      const inputTokenProgram = orderOutput.match(/inputTokenProgram value: (.*)/)?.[1];
      const outputTokenProgram = orderOutput.match(/outputTokenProgram value: (.*)/)?.[1];
      const inputMintReserve = orderOutput.match(/inputMintReserve value: (.*)/)?.[1];
      const uniqueId = orderOutput.match(/uniqueId value: (.*)/)?.[1];

      // Add detailed debug logs
      console.log('\n=== Order Debug ===');
      console.log('Order ID:', order.pubkey.toString());
      console.log('\nRaw Dates:');
      console.log('createdAt:', createdAtMatch);
      console.log('updatedAt:', updatedAtMatch);
      console.log('expiredAt value:', expiredAtValue);
      console.log('expiredAt date:', expiredAtDate);

      // Add debug to date parsing
      const parseDate = (dateStr: string | undefined): string => {
        console.log('\nParsing Date:', dateStr);
        if (!dateStr) throw new Error('Date string required');
        return dateStr;  // Already in our format from analyzer
      };

      // Add debug to expiredAt parsing
      const parseExpiredAt = (value: string | undefined, date: string | undefined): string | undefined => {
        console.log('\nParsing ExpiredAt:');
        console.log('Value:', value);
        console.log('Date:', date);
        
        if (date) return date;  // Use date string if we have it
        if (!value || value === 'None') return 'None';
        return undefined;
      };

      // Add debug for order type determination
      console.log('Order Type Determination:', {
        id: order.pubkey.toString(),
        inputMint,
        outputMint,
        orderType: outputMint === TOKENS.CHAOS.address || outputMint === TOKENS.LOGOS.address 
            ? 'BUY' 
            : 'SELL',
        tokenType: inputMint === TOKENS.CHAOS.address || outputMint === TOKENS.CHAOS.address 
            ? 'CHAOS' 
            : 'LOGOS'
      });

      if (maker && inputMint && outputMint) {
        console.log('\n=== Processing Order ===');
        console.log('Order ID:', order.pubkey.toString());
        
        const [inputTokenInfo, outputTokenInfo] = await Promise.all([
          getTokenInfo(connection, inputMint),
          getTokenInfo(connection, outputMint)
        ]);

        // Skip order if we couldn't get token info
        if (!inputTokenInfo || !outputTokenInfo) {
          console.log('��️ Skipping order due to missing token info');
          continue;
        }

        console.log('Input Token:', inputTokenInfo);
        console.log('Output Token:', outputTokenInfo);
        
        // Determine order type
        const orderType = outputMint === TOKENS.CHAOS.address || outputMint === TOKENS.LOGOS.address 
            ? 'BUY' 
            : 'SELL';

        uiOrders.push({
          id: order.pubkey.toString(),
          maker: new PublicKey(maker),
          inputMint: inputTokenInfo,
          outputMint: outputTokenInfo,
          makingAmount,
          takingAmount,
          oriMakingAmount,
          oriTakingAmount,
          borrowMakingAmount: 0,
          status: 'open',
          createdAt: parseDate(createdAtMatch),
          updatedAt: parseDate(updatedAtMatch),
          expiredAt: parseExpiredAt(expiredAtValue, expiredAtDate),
          tokenType: inputMint === TOKENS.CHAOS.address || outputMint === TOKENS.CHAOS.address 
            ? 'CHAOS' 
            : 'LOGOS',
          orderType,
          feeBps,
          feeAccount: feeAccount || '',
          bump: 0,
          inputTokenProgram: inputTokenProgram || '',
          outputTokenProgram: outputTokenProgram || '',
          inputMintReserve: inputMintReserve || '',
          uniqueId: uniqueId || '0'
        });
      }
    }

    // After getting all orders but before writing to file:
    outputStream.write('=== DETAILED ORDER SUMMARY ===\n\n');

    // CHAOS Summary
    const chaosOrdersBuy = uiOrders.filter(o => 
        o.tokenType === 'CHAOS' && o.orderType === 'BUY'
    );
    const chaosOrdersSell = uiOrders.filter(o => 
        o.tokenType === 'CHAOS' && o.orderType === 'SELL'
    );

    outputStream.write('CHAOS:\n');
    outputStream.write(`- Total Orders: ${chaosOrdersBuy.length + chaosOrdersSell.length}\n`);
    outputStream.write('- Buy Orders:\n');
    outputStream.write(`  • Total: ${chaosOrdersBuy.length}\n`);
    chaosOrdersBuy.forEach(order => {
        outputStream.write(`  • ${order.inputMint.symbol} → CHAOS: ${order.makingAmount} ${order.inputMint.symbol} for ${order.takingAmount} CHAOS\n`);
    });
    outputStream.write('- Sell Orders:\n');
    outputStream.write(`  • Total: ${chaosOrdersSell.length}\n`);
    chaosOrdersSell.forEach(order => {
        outputStream.write(`  • CHAOS → ${order.outputMint.symbol}: ${order.makingAmount} CHAOS for ${order.takingAmount} ${order.outputMint.symbol}\n`);
    });

    // LOGOS Summary
    const logosOrdersBuy = uiOrders.filter(o => 
        o.tokenType === 'LOGOS' && o.orderType === 'BUY'
    );
    const logosOrdersSell = uiOrders.filter(o => 
        o.tokenType === 'LOGOS' && o.orderType === 'SELL'
    );

    outputStream.write('\nLOGOS:\n');
    outputStream.write(`- Total Orders: ${logosOrdersBuy.length + logosOrdersSell.length}\n`);
    outputStream.write('- Buy Orders:\n');
    outputStream.write(`  • Total: ${logosOrdersBuy.length}\n`);
    logosOrdersBuy.forEach(order => {
        outputStream.write(`  • ${order.inputMint.symbol} → LOGOS: ${order.makingAmount} ${order.inputMint.symbol} for ${order.takingAmount} LOGOS\n`);
    });
    outputStream.write('- Sell Orders:\n');
    outputStream.write(`  • Total: ${logosOrdersSell.length}\n`);
    logosOrdersSell.forEach(order => {
        outputStream.write(`  • LOGOS → ${order.outputMint.symbol}: ${order.makingAmount} LOGOS for ${order.takingAmount} ${order.outputMint.symbol}\n`);
    });

    outputStream.write('\n----------------------------------------\n\n');

    // Before JSON write
    console.log('\nPreparing JSON write:');
    const jsonData = {
      lastUpdate: new Date().toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
        hour12: false
      }).replace(',', '') + ' +UTC',
      orders: uiOrders
        .sort((a, b) => {
          // Sort BUY orders first, then by date
          if (a.orderType !== b.orderType) {
            return a.orderType === 'BUY' ? -1 : 1;
          }
          // If same type, sort by date (newest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .map(order => ({
          ...order,
          createdAt: order.createdAt,     // Already a string
          updatedAt: order.updatedAt,     // Already a string
          expiredAt: order.expiredAt      // Already a string or 'None'
        }))
    };

    fs.writeFileSync('public/limit-orders.json', JSON.stringify(jsonData, null, 2));

    outputStream.end();
    console.log('Analysis complete:');
    console.log(`- Text output: ${outputFile}`);
    console.log('- UI data: public/limit-orders.json');

    // Return the orders
    return uiOrders;

  } catch (error) {
    console.error('Error in analyzer:', error);
    throw error;
  }
}

// Add proper error handling for main
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export const runAnalyzer = async () => {
  try {
    const orders = await main();
    return orders;  // Return the orders array
  } catch (error) {
    console.error('Error in runAnalyzer:', error);
    throw error;  // Re-throw to be caught by API
  }
}; 