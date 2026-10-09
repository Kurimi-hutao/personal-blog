import { readFile } from 'node:fs/promises';

export function createUploader({ COS, mime, config, credentials, toPhysicalKey, report = console.log, request = fetch, read = readFile }) {
  return async ({ files }) => {
    for (const file of files) {
      const body = await read(file.localPath);
      const contentType = mime.lookup(file.cloudPath) || 'application/octet-stream';
      async function send(method, data, query, type = contentType) {
       for (let attempt = 0; attempt < 4; attempt++) {
        // Use the COS SDK's standard endpoint first; alternate with CloudBase's endpoint.
        const cos = new COS({
          ...credentials, KeepAlive: false, Timeout: 60000, RetryTimes: 0,
          Protocol: 'https:',
          ...(attempt % 2 ? { Domain: '{Bucket}.cos.{Region}.tencentcos.cn' } : {}),
        });
        report(`${method} ${file.cloudPath} (${data.length} bytes${query?.partNumber ? `, part ${query.partNumber}` : ''}), attempt ${attempt + 1}/4`);
        try {
          const { Url } = await new Promise((resolve, reject) => cos.getObjectUrl({
            Bucket: config.bucket, Region: config.region,
            Key: toPhysicalKey(config.basePath, file.cloudPath),
            Method: method, Sign: true, Expires: 1800, Query: query,
          }, (error, response) => error ? reject(error) : resolve(response)));
          const response = await request(Url, {
            method, body: data, signal: AbortSignal.timeout(120000), redirect: 'error',
            headers: { 'content-type': type },
          });
          const payload = await response.text();
          if (!response.ok || /<Error>/.test(payload)) {
            const code = payload.match(/<Code>([^<]+)<\/Code>/)?.[1] || `HTTP_${response.status}`;
            throw Object.assign(new Error(code), { code });
          }
          return { payload, etag: response.headers.get('etag') };
        } catch (error) {
          report(`${method} failed: ${file.cloudPath}; code=${error.name === 'TimeoutError' ? error.name : error.code || error.name || 'unknown'}`);
          if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 2000));
        }
       }
       throw new Error(`Upload failed after 4 bounded attempts: ${file.cloudPath}`);
      }
      const chunkSize = 1024 * 1024;
      if (body.length <= chunkSize) {
        await send('PUT', body);
        continue;
      }
      const init = await send('POST', Buffer.alloc(0), { uploads: '' });
      const uploadId = init.payload.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
      if (!uploadId) throw new Error(`Missing multipart upload ID: ${file.cloudPath}`);
      try {
        const parts = [];
        for (let start = 0, number = 1; start < body.length; start += chunkSize, number++) {
          const part = await send('PUT', body.subarray(start, start + chunkSize), { partNumber: String(number), uploadId });
          if (!part.etag) throw new Error(`Missing ETag: ${file.cloudPath}, part ${number}`);
          parts.push(`<Part><PartNumber>${number}</PartNumber><ETag>${part.etag.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</ETag></Part>`);
        }
        await send('POST', Buffer.from(`<CompleteMultipartUpload>${parts.join('')}</CompleteMultipartUpload>`), { uploadId }, 'application/xml');
      } catch (error) {
        try { await send('DELETE', Buffer.alloc(0), { uploadId }); } catch { report(`Could not abort multipart upload: ${file.cloudPath}`); }
        throw error;
      }
    }
  };
}
