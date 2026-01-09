import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Configure pg to return DATE types as strings instead of Date objects
// This prevents timezone conversion issues
pg.types.setTypeParser(1082, (val) => val); // 1082 is the OID for DATE type

// Support both DATABASE_URL (Render) and individual env vars (local)
const isProduction = process.env.NODE_ENV === 'production';

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      // Serverless optimizations
      max: 5,                    // Fewer connections for serverless
      min: 0,                    // Allow pool to be empty
      idleTimeoutMillis: 10000,  // Close idle connections faster
      connectionTimeoutMillis: 5000,  // Fail fast if can't connect
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'scheduling_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('✓ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;
