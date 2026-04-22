import net from "node:net";
import { IncomingMessage, ServerResponse } from "node:http";
import type express from "express";

import { createLegacyExpressApp } from "./index";

const legacyApp = createLegacyExpressApp();

/**
 * Dispatch a Fetch `Request` through the legacy Express app and return a Fetch `Response`.
 *
 * This is intentionally a small compatibility bridge: it avoids rewriting the entire API
 * surface while we migrate hosting to Vercel + Supabase Postgres.
 */
export async function dispatchLegacyExpressRequest(webReq: Request): Promise<Response> {
  const socket = new net.Socket();
  const nodeReq = new IncomingMessage(socket) as unknown as express.Request;

  const u = new URL(webReq.url);

  // Fields Express reads most often.
  Object.assign(nodeReq, {
    url: `${u.pathname}${u.search}`,
    method: webReq.method || "GET",
  });

  // Express lowercases header keys internally; mirror that behavior.
  const incomingHeaders: Record<string, string | string[]> = {};
  webReq.headers.forEach((value, key) => {
    incomingHeaders[key.toLowerCase()] = value;
  });

  // Express + `trust proxy` expect standard forwarding headers when running behind Vercel.
  if (!incomingHeaders["host"]) {
    incomingHeaders["host"] = u.host;
  }
  const forwardedFor = webReq.headers.get("x-forwarded-for");
  if (forwardedFor && !incomingHeaders["x-forwarded-for"]) {
    incomingHeaders["x-forwarded-for"] = forwardedFor;
  }
  const forwardedProto = webReq.headers.get("x-forwarded-proto");
  if (forwardedProto && !incomingHeaders["x-forwarded-proto"]) {
    incomingHeaders["x-forwarded-proto"] = forwardedProto;
  }
  Object.assign(nodeReq, { headers: incomingHeaders });

  // Provide a body stream for JSON/urlencoded parsers.
  if (webReq.method !== "GET" && webReq.method !== "HEAD") {
    const buf = Buffer.from(await webReq.arrayBuffer());
    if (buf.byteLength) {
      nodeReq.push(buf);
    }
  }
  nodeReq.push(null);

  const nodeRes = new ServerResponse(nodeReq) as unknown as express.Response;
  const chunks: Buffer[] = [];

  const originalWrite = nodeRes.write.bind(nodeRes);
  const originalEnd = nodeRes.end.bind(nodeRes);

  nodeRes.write = (chunk: unknown, ...args: unknown[]) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return originalWrite(chunk as never, ...(args as never[]));
  };

  nodeRes.end = (chunk?: unknown, ...args: unknown[]) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return originalEnd(chunk as never, ...(args as never[]));
  };

  await new Promise<void>((resolve, reject) => {
    nodeRes.on("finish", resolve);
    nodeRes.on("error", reject);
    legacyApp(nodeReq, nodeRes, (err) => {
      if (err) reject(err);
    });
  });

  const body = Buffer.concat(chunks);
  const headers = new Headers();

  const raw = nodeRes.getHeaders();
  for (const [name, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, String(item));
    } else {
      headers.append(name, String(value));
    }
  }

  const status = nodeRes.statusCode || 200;
  return new Response(body.byteLength ? body : null, { status, headers });
}
