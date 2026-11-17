import { gzipSync } from 'node:zlib';
export function encodeAsset(key, bytes) {
  if (!/\.(?:html|css|js|json|xml|svg)$/.test(key) || bytes.length < 1024) return {bytes};
  const compressed = gzipSync(bytes, {level:9});
  // Single-part metadata is sufficient; leave oversized assets to the existing
  // multipart uploader. Hash and verify the exact bytes stored in COS.
  return compressed.length < 1024 * 1024 && compressed.length < bytes.length
    ? {bytes:compressed, contentEncoding:'gzip'} : {bytes};
}
