const assert = require('node:assert/strict')
const test = require('node:test')
const app = require('./app')

test('GET /health returns mock mode without API key', async () => {
  const server = app.listen(0)
  const { port } = server.address()

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`)
    const data = await response.json()

    assert.equal(response.status, 200)
    assert.equal(data.ok, true)
    assert.equal(data.service, 'deepseek-service')
  } finally {
    server.close()
  }
})

test('POST /api/deepseek/chat returns mock reply without API key', async () => {
  const server = app.listen(0)
  const { port } = server.address()

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/deepseek/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ message: 'hello' }),
    })
    const data = await response.json()

    assert.equal(response.status, 200)
    assert.equal(data.provider, 'deepseek')
    assert.equal(data.mode, 'mock')
    assert.match(data.reply, /hello/)
  } finally {
    server.close()
  }
})

