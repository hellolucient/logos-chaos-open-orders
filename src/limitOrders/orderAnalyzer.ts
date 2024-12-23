import { Connection, PublicKey } from '@solana/web3.js';
import { TOKENS } from './tokenConfig';
import * as fs from 'fs';

// Add at the top with other imports
const decimalCache = new Map<string, number>();

// Helper functions from bufferTest2
function formatSlice(slice: Buffer) {
    return {
        hex: slice.toString('hex'),
        bytes: '[' + [...slice].toString() + ']',
        numbers: [...slice].map(n => n.toString()).join(', ')
    };
}

function displayField(name: string, slice: Buffer, outputStream: fs.WriteStream) {
    const format = formatSlice(slice);
    outputStream.write(`{"name":"${name}","type":"PublicKey"},    // 32 bytes\n`);
    outputStream.write(`${name} as hex: ${format.hex}\n`);
    outputStream.write(`${name} as bytes: ${format.bytes}\n`);
    outputStream.write(`${name} value: ${new PublicKey(slice).toString()}\n\n`);
}

// Make this async since it uses await
async function displayU64Field(
    name: string, 
    slice: Buffer, 
    outputStream: fs.WriteStream, 
    connection: Connection,
    options?: { isTokenAmount?: boolean, mint?: string }
) {
    const format = formatSlice(slice);
    outputStream.write(`{"name":"${name}","type":"u64"},          // 8 bytes\n`);
    outputStream.write(`${name} as hex: ${format.hex}\n`);
    outputStream.write(`${name} as bytes: ${format.bytes}\n`);
    outputStream.write(`${name} as numbers: ${format.numbers}\n`);
    
    const dataView = new DataView(slice.buffer, slice.byteOffset);
    const left = dataView.getUint32(0, true);
    const right = dataView.getUint32(4, true);
    const value = BigInt(left) + (BigInt(right) << 32n);
    
    outputStream.write(`${name} value: ${value}`);
    
    if (options?.isTokenAmount && options.mint) {
        const decimals = await getTokenDecimals(connection, new PublicKey(options.mint));
        const decimalValue = Number(value) / Math.pow(10, decimals);
        outputStream.write(`\n${name} decimal value: ${decimalValue}`);
    }
    outputStream.write('\n\n');
}

function displayOptionI64Field(name: string, slice: Buffer, outputStream: fs.WriteStream) {
    const format = formatSlice(slice);
    outputStream.write(`{"name":"${name}","type":"Option<i64>"},   // 1 or 9 bytes\n`);
    outputStream.write(`${name} as hex: ${format.hex}\n`);
    outputStream.write(`${name} as bytes: ${format.bytes}\n`);
    outputStream.write(`${name} as numbers: ${format.numbers}\n`);
    if (slice[0] === 1) {
        const dataView = new DataView(slice.buffer, slice.byteOffset + 1);
        const timestamp = Number(dataView.getBigInt64(0, true));
        outputStream.write(`${name} value: ${timestamp}\n`);
        const date = new Date(timestamp * 1000);
        const utcDate = date.toLocaleString('en-US', {
            timeZone: 'UTC',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        outputStream.write(`${name} date: ${utcDate} +UTC\n\n`);
    } else {
        outputStream.write(`${name} value: None\n\n`);
    }
}

function displayU16Field(name: string, slice: Buffer, outputStream: fs.WriteStream) {
    const format = formatSlice(slice);
    outputStream.write(`{"name":"${name}","type":"u16"},          // 2 bytes\n`);
    outputStream.write(`${name} as hex: ${format.hex}\n`);
    outputStream.write(`${name} as bytes: ${format.bytes}\n`);
    outputStream.write(`${name} as numbers: ${format.numbers}\n`);
    const dataView = new DataView(slice.buffer, slice.byteOffset);
    outputStream.write(`${name} value: ${dataView.getUint16(0, true)}\n\n`);
}

function displayI64Field(name: string, slice: Buffer, outputStream: fs.WriteStream) {
    const format = formatSlice(slice);
    outputStream.write(`{"name":"${name}","type":"i64"},          // 8 bytes\n`);
    outputStream.write(`${name} as hex: ${format.hex}\n`);
    outputStream.write(`${name} as bytes: ${format.bytes}\n`);
    outputStream.write(`${name} as numbers: ${format.numbers}\n`);
    
    const dataView = new DataView(slice.buffer, slice.byteOffset);
    const timestamp = Number(dataView.getBigInt64(0, true));
    outputStream.write(`${name} value: ${timestamp}\n`);
    const date = new Date(timestamp * 1000);
    const utcDate = date.toLocaleString('en-US', {
        timeZone: 'UTC',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    outputStream.write(`${name} date: ${utcDate} +UTC\n\n`);
}

function displayU8Field(name: string, slice: Buffer, outputStream: fs.WriteStream) {
    const format = formatSlice(slice);
    outputStream.write(`{"name":"${name}","type":"u8"},          // 1 byte\n`);
    outputStream.write(`${name} as hex: ${format.hex}\n`);
    outputStream.write(`${name} as bytes: ${format.bytes}\n`);
    outputStream.write(`${name} as numbers: ${format.numbers}\n`);
    outputStream.write(`${name} value: ${slice[0]}\n\n`);
}

export async function analyzeOrder(orderAccount: string, rawData: string, outputStream: fs.WriteStream, connection: Connection) {
    outputStream.write(`\n=== Analyzing Order: ${orderAccount} ===\n\n`);
    outputStream.write(`Raw Data: ${rawData}\n\n`);
    
    const buffer = Buffer.from(rawData, 'hex');

    // Get input and output mints for decimal calculations
    const inputMint = new PublicKey(buffer.slice(40, 72)).toString();
    const outputMint = new PublicKey(buffer.slice(72, 104)).toString();

    // Display all fields with clear type annotations
    displayField('maker', buffer.slice(8, 40), outputStream);
    displayField('inputMint', buffer.slice(40, 72), outputStream);
    displayField('outputMint', buffer.slice(72, 104), outputStream);
    displayField('inputTokenProgram', buffer.slice(104, 136), outputStream);
    displayField('outputTokenProgram', buffer.slice(136, 168), outputStream);
    displayField('inputMintReserve', buffer.slice(168, 200), outputStream);

    await displayU64Field('uniqueId', buffer.slice(200, 208), outputStream, connection);
    await displayU64Field('oriMakingAmount', buffer.slice(208, 216), outputStream, connection, { 
        isTokenAmount: true, 
        mint: inputMint 
    });
    await displayU64Field('oriTakingAmount', buffer.slice(216, 224), outputStream, connection, { 
        isTokenAmount: true, 
        mint: outputMint 
    });
    await displayU64Field('makingAmount', buffer.slice(224, 232), outputStream, connection, { 
        isTokenAmount: true, 
        mint: inputMint 
    });
    await displayU64Field('takingAmount', buffer.slice(232, 240), outputStream, connection, { 
        isTokenAmount: true, 
        mint: outputMint 
    });
    await displayU64Field('borrowMakingAmount', buffer.slice(240, 248), outputStream, connection, { 
        isTokenAmount: true, 
        mint: inputMint 
    });

    // Check expiredAt's discriminator and adjust field positions
    const expiredAtDiscriminator = buffer[248];
    const expiredAtLength = expiredAtDiscriminator === 1 ? 9 : 1;
    const feeBpsStart = 248 + expiredAtLength;

    displayOptionI64Field('expiredAt', buffer.slice(248, 248 + expiredAtLength), outputStream);
    displayU16Field('feeBps', buffer.slice(feeBpsStart, feeBpsStart + 2), outputStream);
    displayField('feeAccount', buffer.slice(feeBpsStart + 2, feeBpsStart + 34), outputStream);
    displayI64Field('createdAt', buffer.slice(feeBpsStart + 34, feeBpsStart + 42), outputStream);
    displayI64Field('updatedAt', buffer.slice(feeBpsStart + 42, feeBpsStart + 50), outputStream);
    displayU8Field('bump', buffer.slice(feeBpsStart + 50, feeBpsStart + 51), outputStream);

    outputStream.write('----------------------------------------\n');
}

export async function getTokenDecimals(connection: Connection, mint: PublicKey): Promise<number> {
    const mintStr = mint.toString();
    if (decimalCache.has(mintStr)) {
        return decimalCache.get(mintStr)!;
    }
    
    try {
        const info = await connection.getParsedAccountInfo(mint);
        if (info.value?.data && 'parsed' in info.value.data) {
            const decimals = info.value.data.parsed.info.decimals;
            decimalCache.set(mintStr, decimals);
            return decimals;
        }
        return 0;
    } catch (error) {
        console.error(`Error getting decimals for ${mintStr}:`, error);
        return 0;
    }
} 