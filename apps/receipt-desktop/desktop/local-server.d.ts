import type { Server } from "node:http";

export function resolveAssetPath(root: string, pathname: string): string | null;
export function startLocalServer(
  rootDirectory: string,
  options?: { preferredPort?: number },
): Promise<{ origin: string; close(): Promise<void>; server?: Server }>;
