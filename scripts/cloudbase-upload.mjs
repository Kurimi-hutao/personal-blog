import { readFile } from 'node:fs/promises';

export function createUploader({ COS, mime, config, credentials, toPhysicalKey, report = console.log, request = fetch }) {
  return async ({ files }) => {
    for (const file of files) {
      const body = await readFile(file.localPath);
      let uploaded = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        // Use the COS SDK's standard endpoint first; alternate with CloudBase's endpoint.
        const cos = new COS({
          ...credentials, KeepAlive: false, Timeout: 60000, RetryTimes: 0,
          Protocol: 'https:',
          ...(attempt % 2 ? { Domain: '{Bucket}.cos.{Region}.tencentcos.cn' } : {}),
        });
        report(`PUT ${file.cloudPath} (${body.length} bytes), attempt ${attempt + 1}/4`);
        try {
          const { Url } = await new Promise((resolve, reject) => cos.getObjectUrl({
            Bucket: config.bucket, Region: config.region,
            Key: toPhysicalKey(config.basePath, file.cloudPath),
            Method: 'PUT', Sign: true, Expires: 600,
          }, (error, response) => error ? reject(error) : resolve(response)));
          const response = await request(Url, {
            method: 'PUT', body, signal: AbortSignal.timeout(60000), redirect: 'error',
            headers: { 'content-type': mime.lookup(file.cloudPath) || 'application/octet-stream' },
          });
          if (!response.ok) {
            const payload = await response.text();
            const code = payload.match(/<Code>([^<]+)<\/Code>/)?.[1] || `HTTP_${response.status}`;
            throw Object.assign(new Error(code), { code });
          }
          await response.arrayBuffer();
          uploaded = true;
          break;
        } catch (error) {
          report(`PUT failed: ${file.cloudPath}; code=${error.code || error.name || 'unknown'}`);
          if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      if (!uploaded) throw new Error(`Upload failed after 4 bounded attempts: ${file.cloudPath}`);
    }
  };
}
