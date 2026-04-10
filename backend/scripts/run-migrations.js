require('ts-node/register/transpile-only');

async function main() {
  const dataSource = require('../src/database/data-source').default;

  try {
    await dataSource.initialize();
    const migrations = await dataSource.runMigrations();
    console.log(
      JSON.stringify(
        {
          ok: true,
          appliedMigrations: migrations.map((migration) => migration.name),
        },
        null,
        2,
      ),
    );
  } catch (error) {
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
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void main();
