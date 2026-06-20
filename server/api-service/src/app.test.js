const assert = require('node:assert/strict')
const test = require('node:test')
const app = require('./app')

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

