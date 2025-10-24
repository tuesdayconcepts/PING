import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

// Solana RPC endpoint (use your preferred RPC)
const SOLANA_RPC = import.meta.env.VITE_SOLANA_RPC_URL;

// Debug logging
console.log('RPC URL being used:', SOLANA_RPC);
console.log('Environment variable:', import.meta.env.VITE_SOLANA_RPC_URL);
console.log('All env vars:', import.meta.env);

if (!SOLANA_RPC) {
  throw new Error('VITE_SOLANA_RPC_URL environment variable is not set. Please configure it in Netlify.');
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

    // Check if treasury and burn wallets have token accounts
    const treasuryAccountInfo = await connection.getAccountInfo(treasuryTokenAccount);
    const burnAccountInfo = await connection.getAccountInfo(burnTokenAccount);

    if (!treasuryAccountInfo) {
      throw new Error('Treasury wallet does not have a token account for this token. Please contact support.');
    }

    if (!burnAccountInfo) {
      throw new Error('Burn wallet does not have a token account for this token. Please contact support.');
    }

    // Calculate split amounts (assuming 9 decimals for $PING token - adjust if needed)
    const decimals = 9; // Check your $PING token decimals
    const totalLamports = Math.floor(totalAmount * Math.pow(10, decimals));
    const treasuryLamports = Math.floor(totalLamports / 2);
    const burnLamports = totalLamports - treasuryLamports; // Ensure it adds up exactly

    // Check if user has enough PING tokens before attempting transaction
    const userBalance = await getPingBalance(wallet.publicKey.toString());
    if (userBalance < totalAmount) {
      throw new Error(`Insufficient PING tokens. You have ${userBalance.toFixed(2)} PING but need ${totalAmount.toFixed(2)} PING to purchase this hint. Please acquire more PING tokens first.`);
    }

    // Create transaction
    const transaction = new Transaction();

    // Check if user has a token account, create if not
    const userAccountInfo = await connection.getAccountInfo(userTokenAccount);
    if (!userAccountInfo) {
      console.log('User token account does not exist, creating...');
      
      // Check SOL balance before creating account
      const solBalance = await connection.getBalance(wallet.publicKey);
      const minRequiredSOL = 3000000; // 0.003 SOL in lamports
      
      if (solBalance < minRequiredSOL) {
        throw new Error(`Insufficient SOL balance. You need at least 0.003 SOL to create a token account and pay transaction fees. Current balance: ${(solBalance / 1000000000).toFixed(6)} SOL`);
      }
      
      const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
      
      const createAccountIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        userTokenAccount, // associated token account
        wallet.publicKey, // owner
        new PublicKey(tokenMint) // mint
      );
      
      transaction.add(createAccountIx);
    }

    // Add transfer instructions
    transaction.add(
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

    // Set fee payer
    transaction.feePayer = wallet.publicKey;

    // Get fresh blockhash right before signing
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;

    // Sign transaction
    const signed = await wallet.signTransaction(transaction);
    
    // Send transaction
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
      if (error.message.includes('Insufficient funds') || error.message.includes('insufficient lamports')) {
        throw new Error('Insufficient SOL balance. You need at least 0.003 SOL to create a token account and pay transaction fees.');
      }
      if (error.message.includes('insufficient funds') && error.message.includes('Transfer')) {
        throw new Error('Insufficient PING tokens. You need to have PING tokens in your wallet to purchase hints. Please acquire some PING tokens first.');
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

/**
 * Get user's PING token balance
 */
export async function getPingBalance(walletAddress: string): Promise<number> {
  try {
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');

    const tokenAccount = await getAssociatedTokenAddress(
      new PublicKey(TOKEN_MINT),
      new PublicKey(walletAddress)
    );

    const accountInfo = await getAccount(connection, tokenAccount);
    const decimals = 9; // Adjust based on your token
    const balance = Number(accountInfo.amount) / Math.pow(10, decimals);

    return balance;
  } catch (error) {
    console.error('Failed to get PING balance:', error);
    return 0;
  }
}

