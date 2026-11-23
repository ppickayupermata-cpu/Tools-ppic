import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Saat `npm run dev`, folder /api dijalankan langsung oleh Vite dan .env dibaca otomatis.
// (Di Vercel produksi, folder /api dijalankan Vercel seperti biasa.)
function apiDev(env) {
  return {
    name: 'api-dev',
    configureServer(server) {
      Object.assign(process.env, env)
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next()
        const name = req.url.split('?')[0].replace('/api/', '').replace(/[^a-z0-9_-]/gi, '')
        const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
        if (!name || name.startsWith('_')) return send(404, { error: 'API tidak ditemukan' })
        try {
          let raw = ''; for await (const c of req) raw += c
          req.body = raw ? JSON.parse(raw) : {}
          req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
          res.status = c => { res.statusCode = c; return res }
          res.json = o => send(res.statusCode || 200, o)
          const mod = await server.ssrLoadModule(`/api/${name}.js`)
          await mod.default(req, res)
        } catch (e) { console.error(e); send(500, { error: e.message }) }
      })
    }
  }
}
export default defineConfig(({ mode }) => ({ plugins: [react(), apiDev(loadEnv(mode, process.cwd(), ''))] }))
