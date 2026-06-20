const assert = require('node:assert/strict')
const test = require('node:test')
const app = require('./app')
const originalFetch = global.fetch

test('GET /health returns service status', async () => {
  const server = app.listen(0)
  const { port } = server.address()

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`)
    const data = await response.json()

    assert.equal(response.status, 200)
    assert.equal(data.ok, true)
    assert.equal(data.service, 'api-service')
  } finally {
    server.close()
  }
})

test('GET /api/ping returns pong', async () => {
  const server = app.listen(0)
  const { port } = server.address()

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/ping`)
    const data = await response.json()

    assert.equal(response.status, 200)
    assert.equal(data.message, 'pong')
  } finally {
    server.close()
  }
})

test('POST /api/images/generations proxies authorization header', async () => {
  global.fetch = async (url, options) => {
    if (String(url) === 'http://127.0.0.1:3022/api/images/generations') {
      assert.equal(options.method, 'POST')
      assert.equal(options.headers.authorization, 'Bearer valid-token')
      assert.equal(options.headers['content-type'], 'application/json')
      assert.deepEqual(JSON.parse(options.body), { prompt: 'black hole train' })

      return new Response(
        JSON.stringify({
          provider: 'volcengine-ark',
          mode: 'mock',
          data: [{ url: 'https://example.com/mock-image.png' }],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )
    }

    return originalFetch(url, options)
  }

  const server = app.listen(0)
  const { port } = server.address()

  try {
    const response = await originalFetch(`http://127.0.0.1:${port}/api/images/generations`, {
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
  } finally {
    server.close()
    global.fetch = originalFetch
  }
})

