const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
});

async function run() {
  console.log("Connecting to Postgres on 127.0.0.1:54322...");
  await client.connect();
  console.log("Connected successfully!");
  
  const res = await client.query('SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = \'public\';');
  console.log("Tables in public schema:");
  console.log(res.rows.map(r => r.tablename));
  
  await client.end();
}

run().catch(console.error);
