import { inspectDatabase } from './database-tools.js';

inspectDatabase()
  .then((result) => {
    console.info(JSON.stringify(result, null, 2));
  })
  .catch(() => {
    console.error(
      'Database inspection failed. Check DATABASE_URL, credentials, TLS and connectivity. No data was modified.',
    );
    process.exitCode = 1;
  });
