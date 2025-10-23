import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

// Solana RPC endpoint (use your preferred RPC)
const SOLANA_RPC = import.meta.env.VITE_SOLANA_RPC_URL;

// Debug logging
console.log('RPC URL being used:', SOLANA_RPC);
console.log('Environment variable:', import.meta.env.VITE_SOLANA_RPC_URL);
console.log('All env vars:', import.meta.env);

if (!SOLANA_RPC) {
  throw new Error('VITE_SOLANA_RPC_URL environment variable is not set. Please configure it in Railway.');
}

/**
 * Create and send a dual-transfer transaction for hint purchase
 * Sends 50% to treasury, 50% to burn wallet
 * 
 * @param wallet - Connected wallet adapter
 * @param treasuryAddress - Treasury wallet address
 * @param burnAddress - Burn wallet address
 * @param totalAmount - Total amount of $PING to send
 * @param tokenMint - $PING SPL token mint address
 * @returns Transaction signature
 */
export async function sendHintPayment(
  wallet: WalletContextState,
  treasuryAddress: string,
  burnAddress: string,
  totalAmount: number,
  tokenMint: string
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  // Validate wallet addresses before creating PublicKey objects
  if (!treasuryAddress || treasuryAddress.length < 32) {
    throw new Error('Invalid treasury wallet address. Please check your settings configuration.');
  }
  if (!burnAddress || burnAddress.length < 32) {
    throw new Error('Invalid burn wallet address. Please check your settings configuration.');
  }
  if (!tokenMint || tokenMint.length < 32) {
    throw new Error('Invalid token mint address. Please check your settings configuration.');
  }

  const connection = new Connection(SOLANA_RPC, 'confirmed');

  try {
    // Test RPC connection first
    await connection.getLatestBlockhash();
    // Get token account info to find the SPL token program
    const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction } = await import('@solana/spl-token');

    // Get user's token account
    const userTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(tokenMint),
      wallet.publicKey
    );

    // Get treasury token account
    const treasuryTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(tokenMint),
      new PublicKey(treasuryAddress)
    );

    // Get burn token account
    const burnTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(tokenMint),
      new PublicKey(burnAddress)
    );

    // Calculate split amounts (assuming 9 decimals for $PING token - adjust if needed)
    const decimals = 9; // Check your $PING token decimals
    const totalLamports = Math.floor(totalAmount * Math.pow(10, decimals));
    const treasuryLamports = Math.floor(totalLamports / 2);
    const burnLamports = totalLamports - treasuryLamports; // Ensure it adds up exactly

    // Create transaction with both transfers
    const transaction = new Transaction().add(
      // Transfer 1: 50% to treasury
      createTransferInstruction(
        userTokenAccount,
        treasuryTokenAccount,
        wallet.publicKey,
        treasuryLamports,
        [],
        TOKEN_PROGRAM_ID
      ),
      // Transfer 2: 50% to burn wallet
      createTransferInstruction(
        userTokenAccount,
        burnTokenAccount,
        wallet.publicKey,
        burnLamports,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign and send transaction
    const signed = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize());

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
  } catch (error) {
    console.error('Transaction failed:', error);
    
    // Handle specific RPC errors
    if (error instanceof Error) {
      if (error.message.includes('403') || error.message.includes('Access forbidden')) {
        throw new Error('RPC endpoint is temporarily unavailable. Please try again in a moment.');
      }
      if (error.message.includes('failed to get recent blockhash') || error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_TIMED_OUT')) {
        throw new Error('Unable to connect to Solana network. Please check your internet connection and try again.');
      }
      if (error.message.includes('Insufficient funds')) {
        throw new Error('Insufficient SOL balance for transaction fees.');
      }
    }
    
    throw error;
  }
}

/**
 * Check if user has enough $PING tokens
 */
export async function checkTokenBalance(
  walletAddress: string,
  tokenMint: string,
  requiredAmount: number
): Promise<boolean> {
  try {
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');

    const tokenAccount = await getAssociatedTokenAddress(
      new PublicKey(tokenMint),
      new PublicKey(walletAddress)
    );

    const accountInfo = await getAccount(connection, tokenAccount);
    const decimals = 9; // Adjust based on your token
    const balance = Number(accountInfo.amount) / Math.pow(10, decimals);

    return balance >= requiredAmount;
  } catch (error) {
    console.error('Failed to check balance:', error);
    return false;
  }
}

