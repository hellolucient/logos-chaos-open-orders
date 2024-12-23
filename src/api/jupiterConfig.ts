import { Cluster } from '@solana/web3.js';

interface JupiterConfig {
  cluster: Cluster;
  endpoints: {
    main: string;
    price: string;
    quote: string;
    limits: string;
  };
  LOGOS_MINT: string;
  CHAOS_MINT: string;
  USDC_MINT: string;
}

export const jupiterConfig: JupiterConfig = {
  cluster: 'mainnet-beta' as Cluster,
  endpoints: {
    main: 'https://quote-api.jup.ag/v6',
    price: 'https://price.jup.ag/v4',
    quote: 'https://quote-api.jup.ag/v6/quote',
    limits: 'https://api.jup.ag/limit/v2',
  },
  LOGOS_MINT: 'HJUfqXoYjC653f2p33i84zdCC3jc4EuVnbruSe5kpump',
  CHAOS_MINT: '8SgNwESovnbG1oNEaPVhg6CR9mTMSK7jPvcYRe3wpump',
  USDC_MINT: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

export const JUPITER_PROGRAM_ID = 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB';
export const JUPITER_LIMIT_PROGRAM_ID = 'jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu'; 