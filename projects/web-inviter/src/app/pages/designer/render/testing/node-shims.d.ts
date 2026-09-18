// The few Node APIs the parity spec reads its fixtures with (tests run in Node; the app has no @types/node).
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function existsSync(path: string): boolean;
}
declare module 'node:zlib' {
  export function gunzipSync(data: Uint8Array): { toString(encoding: 'utf8'): string };
}
declare const process: { env: Record<string, string | undefined> };
