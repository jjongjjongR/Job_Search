require('ts-node/register/transpile-only');

async function main() {
  const dataSource = require('../src/database/data-source').default;

  try {
    await dataSource.initialize();
    const executed = await dataSource.query(
      'select id, timestamp, name from migrations order by id',
    );
    console.log(JSON.stringify({ ok: true, executed }, null, 2));
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
