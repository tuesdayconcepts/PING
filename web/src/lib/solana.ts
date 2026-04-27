import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

export function generatePrizeWallet(): {
  publicKeyBase58: string;
  secretKeyBase64: string;
} {
  const keypair = Keypair.generate();
  return {
    publicKeyBase58: keypair.publicKey.toBase58(),
    secretKeyBase64: Buffer.from(keypair.secretKey).toString("base64"),
  };
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
}

export type TransferResult = { signature: string };

export async function transferFromTreasury(params: {
  toPublicKey: string;
  lamports: bigint;
  timeoutMs?: number;
}): Promise<TransferResult> {
  const { toPublicKey, lamports } = params;
  const rpcUrl = process.env.SOLANA_RPC_URL;
  const treasuryEnv = process.env.TREASURY_PRIVATE_KEY;
  if (!rpcUrl) throw new Error("SOLANA_RPC_URL not configured");
  if (!treasuryEnv) throw new Error("TREASURY_PRIVATE_KEY not configured");

  const connection = new Connection(rpcUrl, { commitment: "confirmed" });
  let secretKeyBytes: Uint8Array;
  try {
    if (treasuryEnv.trim().startsWith("[")) {
      const arr: number[] = JSON.parse(treasuryEnv);
      secretKeyBytes = Uint8Array.from(arr);
    } else {
      secretKeyBytes = new Uint8Array(Buffer.from(treasuryEnv, "base64"));
    }
  } catch {
    throw new Error(
      "Invalid TREASURY_PRIVATE_KEY format. Use base64 or JSON byte array."
    );
  }

  const treasury = Keypair.fromSecretKey(secretKeyBytes);
  const to = new PublicKey(toPublicKey);
  const ix = SystemProgram.transfer({
    fromPubkey: treasury.publicKey,
    toPubkey: to,
    lamports: Number(lamports),
  });
  const tx = new Transaction().add(ix);
  const timeoutMs = params.timeoutMs ?? 20000;
  const withTimeout = <T>(p: Promise<T>, ms: number) =>
    Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Transfer timeout after ${ms}ms`)), ms)
      ),
    ]);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const sig = await withTimeout(
        sendAndConfirmTransaction(connection, tx, [treasury], {
          commitment: "confirmed",
        }),
        timeoutMs
      );
      return { signature: sig };
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr || new Error("Transfer failed");
}

export async function getSolBalance(pubkeyBase58: string): Promise<number> {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("SOLANA_RPC_URL not configured");
  const connection = new Connection(rpcUrl, { commitment: "confirmed" });
  const pubkey = new PublicKey(pubkeyBase58);
  const lamports = await connection.getBalance(pubkey, { commitment: "confirmed" });
  return lamports / LAMPORTS_PER_SOL;
}
