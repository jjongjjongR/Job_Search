const fs = require('fs/promises');
const path = require('path');

const tempRoot = path.resolve(process.cwd(), 'storage', 'temp');
const retentionSeconds = Number(process.env.TEMP_FILE_RETENTION_SECONDS ?? 600);
const dryRun = process.argv.includes('--dry-run');

async function pathExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectExpiredFiles(directory, nowMs, expiredFiles = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    const resolvedPath = path.resolve(entryPath);
    const relativePath = path.relative(tempRoot, resolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectExpiredFiles(resolvedPath, nowMs, expiredFiles);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stats = await fs.stat(resolvedPath);
    const ageSeconds = Math.floor((nowMs - stats.mtimeMs) / 1000);
    if (ageSeconds >= retentionSeconds) {
      expiredFiles.push({
        path: resolvedPath,
        relativePath,
        ageSeconds,
      });
    }
  }

  return expiredFiles;
}

async function main() {
  if (!(await pathExists(tempRoot))) {
    console.log(JSON.stringify({ ok: true, deleted: [], dryRun }, null, 2));
    return;
  }

  const expiredFiles = await collectExpiredFiles(tempRoot, Date.now());
  const deleted = [];

  for (const file of expiredFiles) {
    if (!dryRun) {
      await fs.unlink(file.path).catch(() => undefined);
    }
    deleted.push({
      path: file.relativePath,
      ageSeconds: file.ageSeconds,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        retentionSeconds,
        deleted,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
