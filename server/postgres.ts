import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Build connection config from environment variables
function buildConfig(): pg.PoolConfig {
  const config: pg.PoolConfig = {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'healthcare',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  // SSL for RDS
  if (process.env.PGSSL === 'true') {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

// Create the pool
const pool = new Pool(buildConfig());

// Log pool errors
pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected pool error:', err.message);
});

/**
 * Execute a SQL query with parameters
 */
export async function query(text: string, params?: any[]): Promise<pg.QueryResult> {
  return pool.query(text, params);
}

/**
 * Get a client from the pool (for transactions)
 */
export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

/**
 * Run the schema migration SQL file
 */
export async function runMigrations(): Promise<void> {
  const schemaPath = path.join(process.cwd(), 'server', 'db-schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  
  try {
    await pool.query(sql);
    console.log('[PostgreSQL] Schema migration completed successfully.');
  } catch (err: any) {
    console.error('[PostgreSQL] Migration error:', err.message);
    throw err;
  }
}

/**
 * Health check - simple SELECT 1
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}

/**
 * Test connection with retry logic and exponential backoff
 */
export async function connectWithRetry(maxRetries = 5): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log(`[PostgreSQL] Connected to RDS successfully (attempt ${attempt}).`);
      return true;
    } catch (err: any) {
      console.error(`[PostgreSQL] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 15000);
        console.log(`[PostgreSQL] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('[PostgreSQL] All connection attempts failed.');
  return false;
}

/**
 * Graceful shutdown
 */
export async function shutdown(): Promise<void> {
  console.log('[PostgreSQL] Closing connection pool...');
  await pool.end();
  console.log('[PostgreSQL] Pool closed.');
}

// Handle process termination
process.on('SIGTERM', async () => {
  await shutdown();
});

process.on('SIGINT', async () => {
  await shutdown();
});

export default pool;
