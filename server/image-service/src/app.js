const compression = require('compression')
const cors = require('cors')
const dotenv = require('dotenv')
const express = require('express')
const helmet = require('helmet')
const morgan = require('morgan')

dotenv.config()

const app = express()
const port = Number(process.env.PORT || process.env.IMAGE_SERVICE_PORT || 3022)
const apiKey = process.env.ARK_API_KEY || ''
const baseURL = (
  process.env.ARK_IMAGE_BASE_URL ||
  process.env.ARK_BASE_URL ||
  'https://ark.cn-beijing.volces.com/api/v3'
).replace(/\/$/, '')
const model =
  process.env.ARK_IMAGE_MODEL ||
  process.env.ARK_MODEL ||
  'doubao-seedream-5-0-260128'
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

app.use(helmet())
app.use(compression())
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json({ limit: '2mb' }))
app.use(morgan(process.env.NODE_ENV === 'test' ? 'tiny' : 'combined'))

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'image-service',
    provider: 'volcengine-ark',
    mode: apiKey ? 'live' : 'mock',
    timestamp: new Date().toISOString(),
  })
})

function sendUnauthorized(res) {
  return res.status(401).json({
    error: 'unauthorized',
    message: 'Login required to generate images.',
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

async function readJsonSafely(response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    return { message: text }
  }
}

function buildImagePayload(body, prompt) {
  return {
    model: body.model || model,
    prompt,
    sequential_image_generation:
      body.sequential_image_generation || 'disabled',
    response_format: body.response_format || 'url',
    size: body.size || '2K',
    stream: body.stream === true,
    watermark: body.watermark !== false,
  }
}

app.post('/api/images/generations', requireAuthenticatedUser, async (req, res, next) => {
  try {
    const prompt = String(req.body?.prompt || '').trim()

    if (!prompt) {
      return res.status(400).json({
        error: 'prompt_required',
        message: 'Request body must include a non-empty prompt.',
      })
    }

    const payload = buildImagePayload(req.body || {}, prompt)

    if (!apiKey) {
      return res.json({
        provider: 'volcengine-ark',
        mode: 'mock',
        model: payload.model,
        created: Math.floor(Date.now() / 1000),
        data: [
          {
            url: 'https://example.com/mock-image.png',
            revised_prompt: prompt,
          },
        ],
      })
    }

    const response = await fetch(`${baseURL}/images/generations`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await readJsonSafely(response)

    if (!response.ok) {
      return res.status(response.status).json(
        data || {
          error: 'image_generation_failed',
          message: 'Image generation provider returned an error.',
        },
      )
    }

    res.json({
      ...data,
      provider: 'volcengine-ark',
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
    console.log(`image-service listening on ${port}`)
  })
}

module.exports = app
