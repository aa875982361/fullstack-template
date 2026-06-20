const compression = require('compression')
const cors = require('cors')
const dotenv = require('dotenv')
const express = require('express')
const helmet = require('helmet')
const morgan = require('morgan')

dotenv.config()

const app = express()
const port = Number(process.env.PORT || process.env.API_PORT || 3000)
const deepseekServiceUrl =
  process.env.DEEPSEEK_SERVICE_URL || 'http://127.0.0.1:3021'

app.use(helmet())
app.use(compression())
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan(process.env.NODE_ENV === 'test' ? 'tiny' : 'combined'))

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'api-service',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/ping', (req, res) => {
  res.json({
    message: 'pong',
    service: 'api-service',
  })
})

app.post('/api/deepseek/chat', async (req, res, next) => {
  try {
    const response = await fetch(`${deepseekServiceUrl}/api/deepseek/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: req.body?.message,
      }),
    })

    const data = await response.json()
    res.status(response.status).json(data)
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
    console.log(`api-service listening on ${port}`)
  })
}

module.exports = app

