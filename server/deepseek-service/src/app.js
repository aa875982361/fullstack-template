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

app.post('/api/deepseek/chat', async (req, res, next) => {
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

