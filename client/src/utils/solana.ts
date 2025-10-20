import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

// Solana RPC endpoint (use your preferred RPC)
const SOLANA_RPC = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

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

  const connection = new Connection(SOLANA_RPC, 'confirmed');

  try {
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

