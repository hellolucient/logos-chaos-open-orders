export const TOKENS = {
    CHAOS: {
        address: '8SgNwESovnbG1oNEaPVhg6CR9mTMSK7jPvcYRe3wpump',
        decimals: 6,
        name: 'CHAOS'
    },
    LOGOS: {
        address: 'HJUfqXoYjC653f2p33i84zdCC3jc4EuVnbruSe5kpump',
        decimals: 6,
        name: 'LOGOS'
    },
    USDC: {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
        name: 'USDC'
    },
    USDT: {
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
        name: 'USDT'
    },
    SOL: {
        address: 'So11111111111111111111111111111111111111112',
        decimals: 9,
        name: 'SOL'
    },
    BONK: {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        decimals: 5,
        name: 'BONK'
    },
    RAY: {
        address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        decimals: 6,
        name: 'RAY'
    },
    MSOL: {
        address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
        decimals: 9,
        name: 'MSOL'
    },
    JITOSOL: {
        address: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
        decimals: 9,
        name: 'JitoSOL'
    }
} as const;

export interface TokenDecimalInfo {
    decimals: number;
    isKnown: boolean;
}

export function getTokenDecimals(mintAddress: string): TokenDecimalInfo {
    const token = Object.values(TOKENS).find(t => t.address === mintAddress);
    return {
        decimals: token?.decimals ?? 6,
        isKnown: !!token
    };
}
