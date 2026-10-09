import { readFile } from 'node:fs/promises';

export function createUploader({ COS, mime, config, credentials, toPhysicalKey, report = console.log }) {
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
          await new Promise((resolve, reject) => cos.putObject({
            Bucket: config.bucket, Region: config.region,
            Key: toPhysicalKey(config.basePath, file.cloudPath),
            Body: body, ContentLength: body.length,
            ContentType: mime.lookup(file.cloudPath) || 'application/octet-stream',
          }, (error, response) => error ? reject(error) : resolve(response)));
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
