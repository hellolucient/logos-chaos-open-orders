import bs58 from 'bs58';
import { getTokenDecimals } from './tokenConfig';

export function decodeInstructionData(
  instructionData: string,
  inputMint: string,
  outputMint: string
) {
  const bytes = Array.from(Buffer.from(instructionData, 'base64'));
  
  console.log('Raw bytes:', bytes);  // Log raw bytes for inspection

  const instructionType = bytes[0];
  
  // Get making amount (token being sold/bought)
  const rawMakingAmount = bytes.slice(1, 9).reduce((acc, byte, index) => {
    return acc + (BigInt(byte) << BigInt(8 * index));
  }, BigInt(0));
  
  // Get taking amount (token being received/paid)
  const rawTakingAmount = bytes.slice(9, 17).reduce((acc, byte, index) => {
    return acc + (BigInt(byte) << BigInt(8 * index));
  }, BigInt(0));
  
  const inputDecimalInfo = getTokenDecimals(inputMint);
  const outputDecimalInfo = getTokenDecimals(outputMint);
  
  // Apply proper decimal places based on token type
  const makingAmount = Number(rawMakingAmount) / Math.pow(10, inputDecimalInfo.decimals);
  const takingAmount = Number(rawTakingAmount) / Math.pow(10, outputDecimalInfo.decimals);
  
  return { 
    instructionType: instructionType === 1 ? 'buy' : 'sell',
    makingAmount,    // Amount of token being sold/bought
    takingAmount,    // Amount of token being received/paid
    price: takingAmount / makingAmount,  // Price per token
    inputDecimalInfo,  // Added to expose decimal info
    outputDecimalInfo  // Added to expose decimal info
  };
}

// Convert a base58 address to hex format
export function decodePublicKey(address: string): string {
    return Buffer.from(bs58.decode(address)).toString('hex');
}

// Convert a hex string back to base58 address format
export function encodeToPublicKey(hex: string): string {
    return bs58.encode(Buffer.from(hex, 'hex'));
}
