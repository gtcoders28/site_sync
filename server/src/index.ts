import app from './app';
import { env } from './config/env';
import { pool } from './config/database';

const startServer = async () => {
  try {
    // 1. Verify PostgreSQL Database Connection
    const client = await pool.connect();
    const dbRes = await client.query('SELECT current_database(), current_user, version()');
    client.release();

    console.log('---------------------------------------------------------');
    console.log(`Connected to PostgreSQL: ${dbRes.rows[0].current_database} as ${dbRes.rows[0].current_user}`);
    console.log(`Database Version: ${dbRes.rows[0].version.split(' ')[0]} ${dbRes.rows[0].version.split(' ')[1]}`);
    console.log('---------------------------------------------------------');

    // 2. Start HTTP Server
    const server = app.listen(env.PORT, () => {
      console.log(`CRM Platform Backend running on http://localhost:${env.PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
      console.log(`API Base: http://localhost:${env.PORT}/api/v1`);
      console.log(`Health Check: http://localhost:${env.PORT}/health`);
      console.log('---------------------------------------------------------');
    });

    // 3. Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await pool.end();
          console.log('Database connection pool closed.');
          process.exit(0);
        } catch (err) {
          console.error('Error during pool closing:', err);
          process.exit(1);
        }
      });

      // Force shutdown after 10s if connections don't drain
      setTimeout(() => {
        console.error('Forced shutdown timeout reached. Exiting.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Fatal Error starting CRM Backend server:', err);
    process.exit(1);
  }
};

startServer();
