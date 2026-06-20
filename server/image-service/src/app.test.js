const assert = require('node:assert/strict')
const test = require('node:test')

process.env.SUPABASE_URL = 'http://auth.local'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

const app = require('./app')
const originalFetch = global.fetch

function withMockFetch(handler) {
  global.fetch = async (url, options) => {
    if (String(url) === 'http://auth.local/auth/v1/user') {
      assert.equal(options.headers.apikey, 'service-role-key')
      assert.equal(options.headers.authorization, 'Bearer valid-token')

      return new Response(JSON.stringify({ id: 'user-id' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    return handler(url, options)
  }

  return () => {
    global.fetch = originalFetch
  }
}

test('GET /health returns mock mode without API key', async () => {
  const server = app.listen(0)
  const { port } = server.address()

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`)
    const data = await response.json()

    assert.equal(response.status, 200)
    assert.equal(data.ok, true)
    assert.equal(data.service, 'image-service')
    assert.equal(data.provider, 'volcengine-ark')
  } finally {
    server.close()
  }
})

test('POST /api/images/generations returns 401 without login', async () => {
  const server = app.listen(0)
  const { port } = server.address()

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/images/generations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'black hole train' }),
    })
    const data = await response.json()

    assert.equal(response.status, 401)
    assert.equal(data.error, 'unauthorized')
  } finally {
    server.close()
  }
})

test('POST /api/images/generations returns mock image for logged-in user without API key', async () => {
  const restoreFetch = withMockFetch((url, options) => originalFetch(url, options))
  const server = app.listen(0)
  const { port } = server.address()

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/images/generations`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'black hole train' }),
    })
    const data = await response.json()

    assert.equal(response.status, 200)
    assert.equal(data.provider, 'volcengine-ark')
    assert.equal(data.mode, 'mock')
    assert.equal(data.model, 'doubao-seedream-5-0-260128')
    assert.match(data.data[0].revised_prompt, /black hole train/)
  } finally {
    server.close()
    restoreFetch()
  }
})

