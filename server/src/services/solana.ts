import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

// Utility: generate a new Solana keypair and return encodings suitable for storage
export function generatePrizeWallet(): {
  publicKeyBase58: string;
  secretKeyBase64: string;
} {
  const keypair = Keypair.generate();
  const publicKeyBase58 = keypair.publicKey.toBase58();
  const secretKeyBase64 = Buffer.from(keypair.secretKey).toString("base64");
  return { publicKeyBase58, secretKeyBase64 };
}

// Convert SOL to lamports safely
export function solToLamports(sol: number): bigint {
  // Use bigint to avoid floating point errors
  const lamports = BigInt(Math.round(sol * LAMPORTS_PER_SOL));
  return lamports;
}

// Placeholder for future transfer implementation (approve step)
export type TransferResult = { signature: string };

export async function transferFromTreasury(_: {
  toPublicKey: string;
  lamports: bigint;
  memo?: string;
}): Promise<TransferResult> {
  // Implement in funding step: use Connection + treasury key from env
  // This stub keeps current step focused on wallet generation
  throw new Error("transferFromTreasury not implemented yet");
}


