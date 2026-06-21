const assert = require('node:assert/strict')
const test = require('node:test')

process.env.SUPABASE_URL = 'http://supabase.local'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
process.env.DEEPSEEK_API_KEY = ''

const app = require('./app')
const originalFetch = global.fetch

function createDb() {
  return {
    anonymous_profiles: [],
    emotion_records: [],
    match_queue: [],
    chat_rooms: [],
    chat_room_members: [],
    chat_messages: [],
  }
}

function now() {
  return '2026-06-21T00:00:00.000Z'
}

function withId(table, row) {
  if (table === 'anonymous_profiles' || table === 'chat_room_members') {
    return row
  }

  return {
    id: `${table}-${cryptoRandom()}`,
    created_at: now(),
    ...row,
  }
}

let idCounter = 0
function cryptoRandom() {
  idCounter += 1
  return String(idCounter).padStart(4, '0')
}

function applyFilters(rows, searchParams) {
  let result = [...rows]

  for (const [key, value] of searchParams.entries()) {
    if (['select', 'order', 'limit'].includes(key)) {
      continue
    }

    if (value.startsWith('eq.')) {
      const expected = value.slice(3)
      result = result.filter((row) => String(row[key]) === expected)
    } else if (value.startsWith('neq.')) {
      const expected = value.slice(4)
      result = result.filter((row) => String(row[key]) !== expected)
    } else if (value.startsWith('in.(') && value.endsWith(')')) {
      const allowed = value.slice(4, -1).split(',')
      result = result.filter((row) => allowed.includes(String(row[key])))
    }
  }

  const order = searchParams.get('order')

  if (order) {
    const [field, direction] = order.split('.')
    result.sort((a, b) => {
      const left = String(a[field] || '')
      const right = String(b[field] || '')

      return direction === 'desc' ? right.localeCompare(left) : left.localeCompare(right)
    })
  }

  const limit = Number(searchParams.get('limit') || 0)

  return limit > 0 ? result.slice(0, limit) : result
}

function installMockFetch(db) {
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(String(url))

    if (String(url) === 'http://supabase.local/auth/v1/user') {
      const token = String(options.headers.authorization || '').replace(/^Bearer\s+/i, '')
      const users = {
        'token-a': { id: 'user-a' },
        'token-b': { id: 'user-b' },
      }
      const user = users[token]

      return new Response(JSON.stringify(user || { error: 'invalid token' }), {
        status: user ? 200 : 401,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (parsed.origin !== 'http://supabase.local' || !parsed.pathname.startsWith('/rest/v1/')) {
      return originalFetch(url, options)
    }

    const table = parsed.pathname.replace('/rest/v1/', '')
    const rows = db[table]

    if (!rows) {
      return new Response(JSON.stringify({ message: 'table not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (!options.method || options.method === 'GET') {
      return new Response(JSON.stringify(applyFilters(rows, parsed.searchParams)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (options.method === 'POST') {
      const body = JSON.parse(options.body || 'null')
      const inserted = (Array.isArray(body) ? body : [body]).map((row) =>
        withId(table, row),
      )

      rows.push(...inserted)

      return new Response(JSON.stringify(inserted), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (options.method === 'PATCH') {
      const patch = JSON.parse(options.body || '{}')
      const matching = applyFilters(rows, parsed.searchParams)

      for (const row of matching) {
        Object.assign(row, patch, { updated_at: now() })
      }

      return new Response(JSON.stringify(matching), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ message: 'method not supported' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }
}

async function withServer(handler) {
  const server = app.listen(0)
  const { port } = server.address()

  try {
    await handler(`http://127.0.0.1:${port}`)
  } finally {
    server.close()
    global.fetch = originalFetch
  }
}

test('POST /api/emotions/analyze returns 401 without login', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/emotions/analyze`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text: '今天很焦虑' }),
    })
    const data = await response.json()

    assert.equal(response.status, 401)
    assert.equal(data.error, 'unauthorized')
  })
})

test('POST /api/emotions/analyze returns mock structured emotion', async () => {
  installMockFetch(createDb())

  await withServer(async (baseUrl) => {
    const response = await originalFetch(`${baseUrl}/api/emotions/analyze`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-a',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text: '我今天特别焦虑，脑子停不下来' }),
    })
    const data = await response.json()

    assert.equal(response.status, 200)
    assert.equal(data.mode, 'mock')
    assert.equal(data.analysis.primaryEmotion, 'anxious')
    assert.equal(typeof data.analysis.empathyMessage, 'string')
  })
})

test('POST /api/matches/join matches compatible users and creates room', async () => {
  const db = createDb()
  installMockFetch(db)

  await withServer(async (baseUrl) => {
    const first = await originalFetch(`${baseUrl}/api/matches/join`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-a',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text: '我今天特别焦虑，想找人说话' }),
    })
    const firstData = await first.json()

    assert.equal(first.status, 200)
    assert.equal(firstData.status, 'queued')

    const second = await originalFetch(`${baseUrl}/api/matches/join`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-b',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text: '我也很担心，心里一直悬着' }),
    })
    const secondData = await second.json()

    assert.equal(second.status, 200)
    assert.equal(secondData.status, 'matched')
    assert.equal(secondData.room.members.length, 2)
    assert.equal(db.chat_rooms.length, 1)
    assert.equal(db.chat_room_members.length, 2)
  })
})

test('POST /api/rooms/:roomId/messages rejects non-members', async () => {
  const db = createDb()
  db.chat_rooms.push({
    id: 'room-1',
    status: 'active',
    emotion_summary: {},
    created_at: now(),
  })
  db.chat_room_members.push({
    room_id: 'room-1',
    user_id: 'user-a',
    anonymous_name: '静夜水獭-0001',
    avatar_seed: 'seed-a',
    joined_at: now(),
  })
  installMockFetch(db)

  await withServer(async (baseUrl) => {
    const response = await originalFetch(`${baseUrl}/api/rooms/room-1/messages`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-b',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ content: 'hello' }),
    })
    const data = await response.json()

    assert.equal(response.status, 403)
    assert.equal(data.error, 'room_forbidden')
  })
})
