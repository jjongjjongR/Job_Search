import * as path from 'path';

function hasKorean(value: string) {
  return /[가-힣\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/.test(
    value,
  );
}

function hasLatinMojibake(value: string) {
  return /[À-ÿ\u0080-\u00BF]/.test(value);
}

export function normalizeOriginalName(originalname: string) {
  if (!originalname) {
    return originalname;
  }

  const decoded = Buffer.from(originalname, 'latin1')
    .toString('utf8')
    .normalize('NFC');

  if (
    !hasKorean(originalname) &&
    hasLatinMojibake(originalname) &&
    hasKorean(decoded)
  ) {
    return decoded;
  }

  return originalname.normalize('NFC');
}

export function sanitizeStoredFilename(originalname: string) {
  return normalizeOriginalName(originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function createDownloadDisposition(filename: string) {
  const extension = path.extname(filename);
  const baseName = path.basename(filename, extension);
  const asciiBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'download';
  const asciiFallback = `${asciiBaseName}${extension}`;
  const encodedFilename = encodeURIComponent(filename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
}
