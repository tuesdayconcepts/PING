import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, Connection, sendAndConfirmTransaction } from "@solana/web3.js";

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

export async function transferFromTreasury(params: {
  toPublicKey: string;
  lamports: bigint;
  memo?: string;
}): Promise<TransferResult> {
  const { toPublicKey, lamports } = params;

  const rpcUrl = process.env.SOLANA_RPC_URL;
  const treasuryEnv = process.env.TREASURY_PRIVATE_KEY;
  if (!rpcUrl) throw new Error("SOLANA_RPC_URL not configured");
  if (!treasuryEnv) throw new Error("TREASURY_PRIVATE_KEY not configured");

  const connection = new Connection(rpcUrl, { commitment: "confirmed" });

  // Support base64 secretKey or JSON array
  let secretKeyBytes: Uint8Array;
  try {
    if (treasuryEnv.trim().startsWith("[")) {
      const arr: number[] = JSON.parse(treasuryEnv);
      secretKeyBytes = Uint8Array.from(arr);
    } else {
      const buf = Buffer.from(treasuryEnv, "base64");
      secretKeyBytes = new Uint8Array(buf);
    }
  } catch {
    throw new Error("Invalid TREASURY_PRIVATE_KEY format. Use base64 of secretKey or JSON array of bytes.");
  }

  const treasury = Keypair.fromSecretKey(secretKeyBytes);
  const to = new PublicKey(toPublicKey);

  const ix = SystemProgram.transfer({ fromPubkey: treasury.publicKey, toPubkey: to, lamports: Number(lamports) });
  const tx = new Transaction().add(ix);

  // Simple retry with backoff
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const sig = await sendAndConfirmTransaction(connection, tx, [treasury], { commitment: "confirmed" });
      return { signature: sig };
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  throw lastErr || new Error("Transfer failed");
}


