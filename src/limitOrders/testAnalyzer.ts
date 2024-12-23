import { Connection, PublicKey } from '@solana/web3.js';
import { TOKENS } from './tokenConfig';
import * as fs from 'fs';
import { analyzeOrder } from './orderAnalyzer';

const JUPITER_LIMIT_PROGRAM_ID = 'j1o2qRpjcyUwEvwtcfhEQefh773ZgjxcVRry7LDqg5X';

// Add interface for Jupiter token response
interface JupiterToken {
    address: string;
    chainId: number;
    decimals: number;
    name: string;
    symbol: string;
    logoURI?: string;
    tags?: string[];
}

// Add after JUPITER_LIMIT_PROGRAM_ID
const INPUT_TOKENS = {
    TIER1: [
        TOKENS.USDC,   // Most common stablecoin
        TOKENS.USDT,   // Second most common stablecoin
        TOKENS.SOL,    // Native SOL
    ],
    TIER2: [
        TOKENS.MSOL,   // Liquid staking derivatives
        TOKENS.JITOSOL,
        TOKENS.BONK,   // Popular meme token
    ],
    TIER3: [
        TOKENS.RAY,    // DEX tokens
        // Add more as needed
    ]
};

async function main() {
    try {
        // Create output file first
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = `analysis_output/test_analysis_${timestamp}.txt`;
        const outputStream = fs.createWriteStream(outputFile);

        // Then check Jupiter's token list
        console.log('\n=== Checking Jupiter Token List ===');
        const response = await fetch('https://token.jup.ag/all');
        const jupiterTokens: JupiterToken[] = await response.json();
        
        const jupiterStats = {
            totalTokens: jupiterTokens.length,
            hasUSDC: jupiterTokens.some((t: JupiterToken) => t.address === TOKENS.USDC.address),
            hasSOL: jupiterTokens.some((t: JupiterToken) => t.address === TOKENS.SOL.address),
            hasCHAOS: jupiterTokens.some((t: JupiterToken) => t.address === TOKENS.CHAOS.address),
            hasLOGOS: jupiterTokens.some((t: JupiterToken) => t.address === TOKENS.LOGOS.address)
        };

        // Log to console
        console.log('Jupiter Token Stats:', jupiterStats);

        // Write to file
        outputStream.write('=== JUPITER TOKEN STATS ===\n\n');
        outputStream.write(`Total Tradeable Tokens: ${jupiterStats.totalTokens}\n`);
        outputStream.write(`USDC Available: ${jupiterStats.hasUSDC}\n`);
        outputStream.write(`SOL Available: ${jupiterStats.hasSOL}\n`);
        outputStream.write(`CHAOS Available: ${jupiterStats.hasCHAOS}\n`);
        outputStream.write(`LOGOS Available: ${jupiterStats.hasLOGOS}\n\n`);
        outputStream.write('----------------------------------------\n\n');

        // Initialize connection
        const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=3632daae-4968-4896-9d0d-43f382188194');
        const programId = new PublicKey(JUPITER_LIMIT_PROGRAM_ID);
        const CHAOS_MINT = new PublicKey(TOKENS.CHAOS.address);
        const LOGOS_MINT = new PublicKey(TOKENS.LOGOS.address);

        // Flatten tiers into search array
        const searchTokens = [
            ...INPUT_TOKENS.TIER1,
            ...INPUT_TOKENS.TIER2,
            ...INPUT_TOKENS.TIER3
        ];

        // Log what we're searching
        console.log('\n=== Search Tokens ===');
        console.log('Searching for buy orders with input tokens:');
        searchTokens.forEach(token => {
            console.log(`- ${token.name} (${token.address})`);
        });

        // Fetch ALL orders
        const [chaosInputOrders, logosInputOrders] = await Promise.all([
            // Get SELL orders (where CHAOS/LOGOS is input)
            connection.getProgramAccounts(programId, {
                filters: [
                    { dataSize: 372 },
                    { memcmp: { offset: 40, bytes: CHAOS_MINT.toBase58() }}
                ]
            }),
            connection.getProgramAccounts(programId, {
                filters: [
                    { dataSize: 372 },
                    { memcmp: { offset: 40, bytes: LOGOS_MINT.toBase58() }}
                ]
            })
        ]);

        // Get BUY orders for each input token
        const buyOrderResults = await Promise.all(searchTokens.flatMap(inputToken => [
            // Search for CHAOS buy orders using this input token
            connection.getProgramAccounts(programId, {
                filters: [
                    { dataSize: 372 },
                    { memcmp: { offset: 40, bytes: inputToken.address }},  // Input = token
                    { memcmp: { offset: 72, bytes: CHAOS_MINT.toBase58() }}  // Output = CHAOS
                ]
            }),
            // Search for LOGOS buy orders using this input token
            connection.getProgramAccounts(programId, {
                filters: [
                    { dataSize: 372 },
                    { memcmp: { offset: 40, bytes: inputToken.address }},  // Input = token
                    { memcmp: { offset: 72, bytes: LOGOS_MINT.toBase58() }}  // Output = LOGOS
                ]
            })
        ]));

        // Combine all CHAOS buy orders from different input tokens
        const chaosBuyOrders = buyOrderResults.filter((_, i) => i % 2 === 0).flat();
        const logosBuyOrders = buyOrderResults.filter((_, i) => i % 2 === 1).flat();

        // After the Promise.all queries:
        console.log('\n=== All Orders Found ===');

        console.log('\n=== CHAOS Orders Query Results ===');

        console.log('\nQuery Parameters:');
        console.log({
            programId: programId.toString(),
            chaosMint: CHAOS_MINT.toString(),
            searchOffsets: {
                input: 40,
                output: 72
            }
        });

        console.log('\nCHAOS Input Orders (Sell):');
        console.log('Count:', chaosInputOrders.length);
        for (const order of chaosInputOrders) {
            const data = Buffer.from(order.account.data);
            console.log({
                orderID: order.pubkey.toString(),
                inputMint: new PublicKey(data.slice(40, 72)).toString(),
                outputMint: new PublicKey(data.slice(72, 104)).toString()
            });
        }

        console.log('\nCHAOS Output Orders (Buy):');
        console.log('Count:', buyOrderResults[1].length);
        for (const order of buyOrderResults[1]) {
            const data = Buffer.from(order.account.data);
            console.log({
                orderID: order.pubkey.toString(),
                inputMint: new PublicKey(data.slice(40, 72)).toString(),
                outputMint: new PublicKey(data.slice(72, 104)).toString()
            });
        }

        // Same for LOGOS orders...

        // Write summary
        outputStream.write('=== SUMMARY ===\n\n');
        outputStream.write(`Total Orders: ${buyOrderResults[0].length + buyOrderResults[1].length}\n\n`);
        
        outputStream.write('CHAOS:\n');
        outputStream.write(`- Total: ${buyOrderResults[0].length + buyOrderResults[1].length}\n`);
        outputStream.write(`- Sell Orders: ${buyOrderResults[0].length}\n`);
        outputStream.write(`- Buy Orders: ${buyOrderResults[1].length}\n\n`);
        
        outputStream.write('LOGOS:\n');
        outputStream.write(`- Total: ${buyOrderResults[2].length + buyOrderResults[3].length}\n`);
        outputStream.write(`- Sell Orders: ${buyOrderResults[2].length}\n`);
        outputStream.write(`- Buy Orders: ${buyOrderResults[3].length}\n\n`);

        // Debug output
        console.log('\n=== Order Counts ===');
        console.log({
            chaosSell: chaosInputOrders.length,
            logosSell: logosInputOrders.length,
            chaosBuy: chaosBuyOrders.length,
            logosBuy: logosBuyOrders.length,
            total: chaosInputOrders.length + logosInputOrders.length + 
                   chaosBuyOrders.length + logosBuyOrders.length
        });

        // Look for specific order
        const allOrders = [...buyOrderResults[0], ...buyOrderResults[2], ...buyOrderResults[1], ...buyOrderResults[3]];
        const yourOrder = allOrders.find(o => 
            o.pubkey.toString() === 'AmdQGtE2Wz2vtUJ3arKTVgVsDtLxdkuZotb8d6DQKc6r'
        );

        console.log('\n=== Your Order ===');
        console.log(yourOrder ? 'Found!' : 'Not found');
        if (yourOrder) {
            console.log('Found in:', 
                buyOrderResults[0].some(o => o.pubkey.equals(yourOrder.pubkey)) ? 'chaosSell' :
                buyOrderResults[2].some(o => o.pubkey.equals(yourOrder.pubkey)) ? 'logosSell' :
                buyOrderResults[1].some(o => o.pubkey.equals(yourOrder.pubkey)) ? 'chaosBuy' :
                'logosBuy'
            );
            
            // Show order details
            const data = Buffer.from(yourOrder.account.data);
            console.log('\nOrder Details:');
            console.log('Input Mint:', new PublicKey(data.slice(40, 72)).toString());
            console.log('Output Mint:', new PublicKey(data.slice(72, 104)).toString());
        }

        // After writing summary...
        outputStream.write('=== DETAILED ORDER DATA ===\n\n');

        // Write CHAOS orders
        outputStream.write('=== CHAOS ORDERS ===\n');
        for (const order of buyOrderResults[0]) {
            await analyzeOrder(
                order.pubkey.toString(),
                Buffer.from(order.account.data).toString('hex'),
                outputStream,
                connection
            );
        }

        for (const order of buyOrderResults[1]) {
            await analyzeOrder(
                order.pubkey.toString(),
                Buffer.from(order.account.data).toString('hex'),
                outputStream,
                connection
            );
        }

        // Write LOGOS orders
        outputStream.write('\n=== LOGOS ORDERS ===\n');
        for (const order of buyOrderResults[2]) {
            await analyzeOrder(
                order.pubkey.toString(),
                Buffer.from(order.account.data).toString('hex'),
                outputStream,
                connection
            );
        }

        for (const order of buyOrderResults[3]) {
            await analyzeOrder(
                order.pubkey.toString(),
                Buffer.from(order.account.data).toString('hex'),
                outputStream,
                connection
            );
        }

        outputStream.end();
        console.log('\nAnalysis complete:');
        console.log(`- Test output: ${outputFile}`);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
}); 