const compression = require('compression')
const cors = require('cors')
const dotenv = require('dotenv')
const express = require('express')
const helmet = require('helmet')
const morgan = require('morgan')
const OpenAI = require('openai')

dotenv.config()

const app = express()
const port = Number(process.env.PORT || process.env.DEEPSEEK_PORT || 3021)
const apiKey = process.env.DEEPSEEK_API_KEY || ''
const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

app.use(helmet())
app.use(compression())
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan(process.env.NODE_ENV === 'test' ? 'tiny' : 'combined'))

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'deepseek-service',
    provider: 'deepseek',
    mode: apiKey ? 'live' : 'mock',
    timestamp: new Date().toISOString(),
  })
})

function sendUnauthorized(res) {
  return res.status(401).json({
    error: 'unauthorized',
    message: 'Login required to use DeepSeek.',
  })
}

async function requireAuthenticatedUser(req, res, next) {
  try {
    const authHeader = req.get('authorization') || ''
    const match = authHeader.match(/^Bearer\s+(.+)$/i)

    if (!match) {
      return sendUnauthorized(res)
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        error: 'auth_not_configured',
        message: 'Supabase auth configuration is missing.',
      })
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseServiceRoleKey,
        authorization: `Bearer ${match[1]}`,
      },
    })

    if (response.status === 401 || response.status === 403) {
      return sendUnauthorized(res)
    }

    if (!response.ok) {
      return res.status(502).json({
        error: 'auth_service_unavailable',
        message: 'Unable to verify login status.',
      })
    }

    req.user = await response.json()
    next()
  } catch (error) {
    next(error)
  }
}

app.post('/api/deepseek/chat', requireAuthenticatedUser, async (req, res, next) => {
  try {
    const message = String(req.body?.message || '').trim()

    if (!message) {
      return res.status(400).json({
        error: 'message_required',
        message: 'Request body must include a non-empty message.',
      })
    }

    if (!apiKey) {
      return res.json({
        reply: `Mock DeepSeek reply: ${message}`,
        provider: 'deepseek',
        mode: 'mock',
      })
    }

    const client = new OpenAI({
      apiKey,
      baseURL,
    })

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: message }],
    })

    res.json({
      reply: completion.choices?.[0]?.message?.content || '',
      provider: 'deepseek',
      mode: 'live',
    })
  } catch (error) {
    next(error)
  }
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({
    error: 'internal_server_error',
    message: err.message,
  })
})

if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`deepseek-service listening on ${port}`)
  })
}

module.exports = app

