import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function normalizeExtractedText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();
}

async function extractWithTextutil(
  filePath: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('textutil', [
      '-convert',
      'txt',
      '-stdout',
      filePath,
    ]);
    return normalizeExtractedText(stdout);
  } catch {
    return undefined;
  }
}

async function extractWithStrings(filePath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('strings', [filePath]);
    return normalizeExtractedText(stdout);
  } catch {
    return undefined;
  }
}

// 2026-04-10 신규: 텍스트/문서 파일을 현재 환경에서 읽을 수 있는 텍스트로 변환
export async function extractTextFromUploadedFile(
  file: Express.Multer.File,
): Promise<string> {
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    file.mimetype.startsWith('text/') ||
    ['.txt', '.md', '.json', '.csv'].includes(extension)
  ) {
    return normalizeExtractedText(file.buffer.toString('utf-8'));
  }

  const tempFilePath = path.join(
    tmpdir(),
    `cover-letter-${Date.now()}-${path.basename(file.originalname)}`,
  );

  await fs.writeFile(tempFilePath, file.buffer);

  try {
    const extractedByTextutil = await extractWithTextutil(tempFilePath);
    if (extractedByTextutil) {
      return extractedByTextutil;
    }

    const extractedByStrings = await extractWithStrings(tempFilePath);
    if (extractedByStrings) {
      return extractedByStrings;
    }

    throw new Error('파일에서 읽을 수 있는 텍스트를 추출하지 못했습니다.');
  } finally {
    await fs.unlink(tempFilePath).catch(() => undefined);
  }
}
