const { neon } = require('@neondatabase/serverless');

let sql;
function getSql() {
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}

module.exports = { getSql };
