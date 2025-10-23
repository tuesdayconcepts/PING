import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Solana RPC connection (use your preferred RPC endpoint)
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(SOLANA_RPC, 'confirmed');

interface VerificationResult {
  valid: boolean;
  error?: string;
  treasuryAmount?: number;
  burnAmount?: number;
}

/**
 * Verify a Solana transaction contains dual transfers (treasury + burn)
 * @param txSignature - Transaction signature to verify
 * @param expectedSender - Expected sender wallet address
 * @param treasuryWallet - Expected treasury recipient
 * @param burnWallet - Expected burn wallet recipient
 * @param expectedTotalAmount - Expected total amount in $PING tokens
 * @param tokenMint - $PING SPL token mint address
 * @returns Verification result
 */
export async function verifyHintPurchaseTransaction(
  txSignature: string,
  expectedSender: string,
  treasuryWallet: string,
  burnWallet: string,
  expectedTotalAmount: number,
  tokenMint: string
): Promise<VerificationResult> {
  try {
    // Fetch transaction from blockchain
    const tx = await connection.getTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { valid: false, error: 'Transaction not found' };
    }

    if (!tx.meta || tx.meta.err) {
      return { valid: false, error: 'Transaction failed or has no metadata' };
    }

    // Parse transaction to find SPL token transfers
    const { preTokenBalances, postTokenBalances } = tx.meta;
    
    if (!preTokenBalances || !postTokenBalances) {
      return { valid: false, error: 'No token balance information in transaction' };
    }

    // Find transfers by comparing pre/post balances
    const transfers: Array<{ from: string; to: string; amount: number }> = [];
    
    for (const postBalance of postTokenBalances) {
      const preBalance = preTokenBalances.find(
        (pre) => pre.accountIndex === postBalance.accountIndex
      );
      
      if (!preBalance) continue;
      
      const mint = postBalance.mint;
      if (mint !== tokenMint) continue; // Only check $PING token
      
      const preAmount = parseFloat(preBalance.uiTokenAmount.amount);
      const postAmount = parseFloat(postBalance.uiTokenAmount.amount);
      const diff = postAmount - preAmount;
      
      if (diff !== 0) {
        const owner = postBalance.owner || '';
        const preOwner = preBalance.owner || '';
        
        if (diff > 0) {
          // Received tokens
          transfers.push({
            from: preOwner || 'unknown',
            to: owner,
            amount: diff / Math.pow(10, postBalance.uiTokenAmount.decimals),
          });
        }
      }
    }

    // Verify we have exactly 2 transfers
    if (transfers.length !== 2) {
      return { 
        valid: false, 
        error: `Expected 2 transfers, found ${transfers.length}` 
      };
    }

    // Find treasury and burn transfers
    const treasuryTransfer = transfers.find((t) => t.to === treasuryWallet);
    const burnTransfer = transfers.find((t) => t.to === burnWallet);

    if (!treasuryTransfer) {
      return { valid: false, error: 'Treasury transfer not found' };
    }

    if (!burnTransfer) {
      return { valid: false, error: 'Burn wallet transfer not found' };
    }

    // Verify amounts (50/50 split with ±5% tolerance for rounding/price fluctuation)
    const totalTransferred = treasuryTransfer.amount + burnTransfer.amount;
    const expectedHalf = expectedTotalAmount / 2;
    const tolerance = expectedTotalAmount * 0.05; // 5% tolerance

    if (Math.abs(totalTransferred - expectedTotalAmount) > tolerance) {
      return {
        valid: false,
        error: `Amount mismatch. Expected: ${expectedTotalAmount}, Got: ${totalTransferred}`,
      };
    }

    // Verify 50/50 split (allow small rounding differences)
    const splitTolerance = expectedHalf * 0.1; // 10% tolerance for split
    if (
      Math.abs(treasuryTransfer.amount - expectedHalf) > splitTolerance ||
      Math.abs(burnTransfer.amount - expectedHalf) > splitTolerance
    ) {
      return {
        valid: false,
        error: 'Split not approximately 50/50',
      };
    }

    // All checks passed
    return {
      valid: true,
      treasuryAmount: treasuryTransfer.amount,
      burnAmount: burnTransfer.amount,
    };
  } catch (error) {
    console.error('Transaction verification error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Get current $PING token price from Jupiter API
 * @param tokenMint - $PING SPL token mint address
 * @returns Price in USD or null if unavailable
 */
export async function getPingPriceFromJupiter(tokenMint: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.jup.ag/price/v2?ids=${tokenMint}&showExtraInfo=true`
    );
    
    if (!response.ok) {
      console.error('Jupiter API error:', response.status);
      return null;
    }

    const data = await response.json();
    const priceData = data.data?.[tokenMint];
    
    if (!priceData || typeof priceData.price !== 'number') {
      console.warn('No price data found for token:', tokenMint);
      return null;
    }

    return priceData.price; // Price in USD
  } catch (error) {
    console.error('Failed to fetch $PING price:', error);
    return null;
  }
}

