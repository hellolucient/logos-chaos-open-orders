export interface JupiterLimitOrderResponse {
  id: string;
  owner: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;  // Usually in lamports/base units
  outputAmount: string;
  quoteMint: string;
  price: string;
  status: 'open' | 'filled' | 'cancelled';
  createdAt: string;
  expiryTimestamp: string | null;
  filledTimestamp: string | null;
  executionPrice?: string;
}

export interface JupiterTokenInfo {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
}

export interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  price: string;
  slippage: number;
}

export interface JupiterOpenOrder {
  account: {
    borrowMakingAmount: string;
    createdAt: string;
    expiredAt: string | null;
    makingAmount: string;
    oriMakingAmount: string;
    oriTakingAmount: string;
    takingAmount: string;
    uniqueId: string;
    updatedAt: string;
    feeAccount: string;
    inputMint: string;
    inputMintReserve: string;
    inputTokenProgram: string;
    maker: string;
    outputMint: string;
    outputTokenProgram: string;
    feeBps: number;
    bump: number;
  };
  publicKey: string;
}

export interface CreateOrderRequest {
  inputMint: string;
  outputMint: string;
  maker: string;
  payer: string;
  params: {
    makingAmount: string;
    takingAmount: string;
    expiredAt?: string;
    feeBps?: string;
  };
  computeUnitPrice: string | "auto";
  referral?: string;
  inputTokenProgram?: string;
  outputTokenProgram?: string;
  wrapAndUnwrapSol?: boolean;
}

export interface CreateOrderResponse {
  order: string;
  tx: string;
} 