import { neon } from '@neondatabase/serverless'
export const sql = (...a) => (globalThis.__sql ||= neon(process.env.DATABASE_URL))(...a)
sql.transaction = q => (globalThis.__sql ||= neon(process.env.DATABASE_URL)).transaction(q)
let ready
export const init = () => (ready ||= sql.transaction([
  sql`CREATE TABLE IF NOT EXISTS materials(kode text PRIMARY KEY, deskripsi text, uom text, stok numeric DEFAULT 0)`,
  sql`CREATE TABLE IF NOT EXISTS reservasi(id serial PRIMARY KEY, so text, kode text, deskripsi text, qty numeric, uom text)`,
  sql`CREATE INDEX IF NOT EXISTS reservasi_so_kode ON reservasi(so, kode)`,
  sql`CREATE TABLE IF NOT EXISTS so_columns(pos int PRIMARY KEY, buyer text, so text)`,
  sql`CREATE TABLE IF NOT EXISTS plan(kode text PRIMARY KEY, po1 text, po2 text, po3 text)`,
]).catch(e => { ready = null; throw e }))
