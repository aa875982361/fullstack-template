const compression = require('compression')
const cors = require('cors')
const crypto = require('node:crypto')
const dotenv = require('dotenv')
const express = require('express')
const helmet = require('helmet')
const morgan = require('morgan')
const OpenAI = require('openai')

dotenv.config()

const app = express()
const port = Number(process.env.PORT || process.env.SOCIAL_PORT || 3023)
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const apiKey = process.env.DEEPSEEK_API_KEY || process.env.EMOTION_API_KEY || ''
const baseURL =
  process.env.DEEPSEEK_BASE_URL ||
  process.env.EMOTION_BASE_URL ||
  'https://api.deepseek.com'
const model =
  process.env.DEEPSEEK_MODEL ||
  process.env.EMOTION_MODEL ||
  'deepseek-chat'

app.use(helmet())
app.use(compression())
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan(process.env.NODE_ENV === 'test' ? 'tiny' : 'combined'))

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'social-service',
    provider: 'deepseek',
    mode: apiKey ? 'live' : 'mock',
    timestamp: new Date().toISOString(),
  })
})

function sendUnauthorized(res) {
  return res.status(401).json({
    error: 'unauthorized',
    message: 'Login required to use emotion matching.',
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

function requireSupabaseConfig() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const error = new Error('Supabase service role configuration is missing.')
    error.statusCode = 500
    error.errorCode = 'supabase_not_configured'
    throw error
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

async function postgrest(path, options = {}) {
  requireSupabaseConfig()

  const method = options.method || 'GET'
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: supabaseServiceRoleKey,
      authorization: `Bearer ${supabaseServiceRoleKey}`,
      'content-type': 'application/json',
      ...(method !== 'GET' ? { Prefer: options.prefer || 'return=representation' } : {}),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const data = await readJsonSafely(response)

  if (!response.ok) {
    const error = new Error(data?.message || `PostgREST request failed: ${response.status}`)
    error.statusCode = response.status
    error.errorCode = data?.code || data?.error || 'postgrest_error'
    throw error
  }

  return data
}

function clamp(value, min, max, fallback) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return fallback
  }

  return Math.min(max, Math.max(min, number))
}

function normalizeEmotionAnalysis(input) {
  const analysis = input && typeof input === 'object' ? input : {}
  const mixedEmotions = Array.isArray(analysis.mixedEmotions)
    ? analysis.mixedEmotions
    : Array.isArray(analysis.mixed_emotions)
      ? analysis.mixed_emotions
      : []

  return {
    primaryEmotion: String(
      analysis.primaryEmotion || analysis.primary_emotion || 'mixed',
    ).slice(0, 40),
    mixedEmotions: mixedEmotions.slice(0, 5).map((emotion) => ({
      label: String(emotion?.label || emotion?.emotion || 'mixed').slice(0, 40),
      score: clamp(emotion?.score, 0, 1, 0.5),
    })),
    intensity: clamp(analysis.intensity, 0, 1, 0.5),
    valence: clamp(analysis.valence, -1, 1, 0),
    arousal: clamp(analysis.arousal, 0, 1, 0.5),
    tendency: String(analysis.tendency || 'needs_listening').slice(0, 80),
    confidence: clamp(analysis.confidence, 0, 1, 0.6),
    empathyMessage: String(
      analysis.empathyMessage ||
        analysis.empathy_message ||
        '我听见了你此刻复杂的感受，会尽量为你匹配一个能理解这种状态的人。',
    ).slice(0, 240),
  }
}

function heuristicEmotionAnalysis(text) {
  const value = text.toLowerCase()
  const rules = [
    {
      emotion: 'anxious',
      keywords: ['焦虑', '担心', '害怕', '紧张', 'panic', 'anxious', 'worry'],
      valence: -0.45,
      arousal: 0.82,
      tendency: 'needs_reassurance',
      empathy: '你像是在承受一种悬着的感觉，先不用急着证明自己没事。',
    },
    {
      emotion: 'sad',
      keywords: ['难过', '伤心', '失落', '哭', 'sad', 'depressed', 'down'],
      valence: -0.72,
      arousal: 0.38,
      tendency: 'needs_companionship',
      empathy: '这份低落值得被认真接住，你不需要一个人把它吞下去。',
    },
    {
      emotion: 'angry',
      keywords: ['生气', '愤怒', '烦死', '委屈', 'angry', 'mad', 'furious'],
      valence: -0.56,
      arousal: 0.78,
      tendency: 'needs_validation',
      empathy: '你可能很需要有人先承认这件事确实让人不好受。',
    },
    {
      emotion: 'lonely',
      keywords: ['孤独', '没人懂', '一个人', 'lonely', 'alone'],
      valence: -0.62,
      arousal: 0.42,
      tendency: 'needs_connection',
      empathy: '这种没人能靠近的感觉很重，我们会帮你找一个相近频率的人。',
    },
    {
      emotion: 'happy',
      keywords: ['开心', '高兴', '期待', '快乐', 'happy', 'excited', 'great'],
      valence: 0.72,
      arousal: 0.68,
      tendency: 'wants_sharing',
      empathy: '这份轻快很珍贵，适合被分享给一个能一起回应它的人。',
    },
  ]
  const matched = rules.find((rule) =>
    rule.keywords.some((keyword) => value.includes(keyword)),
  )
  const selected =
    matched ||
    {
      emotion: 'mixed',
      valence: -0.05,
      arousal: 0.52,
      tendency: 'needs_listening',
      empathy: '你此刻的感受有些交织，我们会优先匹配能耐心倾听的人。',
    }
  const intensity = Math.min(0.95, Math.max(0.35, text.length / 120))

  return normalizeEmotionAnalysis({
    primaryEmotion: selected.emotion,
    mixedEmotions: [{ label: selected.emotion, score: 0.74 }],
    intensity,
    valence: selected.valence,
    arousal: selected.arousal,
    tendency: selected.tendency,
    confidence: matched ? 0.72 : 0.55,
    empathyMessage: selected.empathy,
  })
}

function extractJsonObject(content) {
  try {
    return JSON.parse(content)
  } catch (error) {
    const match = content.match(/\{[\s\S]*\}/)

    if (!match) {
      throw error
    }

    return JSON.parse(match[0])
  }
}

async function analyzeEmotion(text) {
  if (!apiKey) {
    return {
      analysis: heuristicEmotionAnalysis(text),
      provider: 'deepseek',
      mode: 'mock',
    }
  }

  const client = new OpenAI({ apiKey, baseURL })
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You classify user emotions for an anonymous emotional social app. Return strict JSON with keys: primaryEmotion, mixedEmotions, intensity, valence, arousal, tendency, confidence, empathyMessage. Use numbers in the documented ranges: intensity 0..1, valence -1..1, arousal 0..1, confidence 0..1. empathyMessage must be short, warm, and in Chinese.',
      },
      {
        role: 'user',
        content: text,
      },
    ],
  })
  const content = completion.choices?.[0]?.message?.content || '{}'

  return {
    analysis: normalizeEmotionAnalysis(extractJsonObject(content)),
    provider: 'deepseek',
    mode: 'live',
  }
}

function validateEmotionText(value) {
  const text = String(value || '').trim()

  if (!text) {
    const error = new Error('Please describe how you feel right now.')
    error.statusCode = 400
    error.errorCode = 'emotion_text_required'
    throw error
  }

  if (text.length > 1000) {
    const error = new Error('Emotion text must be 1000 characters or fewer.')
    error.statusCode = 400
    error.errorCode = 'emotion_text_too_long'
    throw error
  }

  return text
}

function randomSuffix(userId) {
  return crypto.createHash('sha256').update(userId).digest('hex').slice(0, 4)
}

function generateAnonymousProfile(userId) {
  const names = [
    '静夜水獭',
    '月光鲸鱼',
    '雾中狐狸',
    '暖风信使',
    '星河旅人',
    '雨后鹿影',
  ]
  const index = Number.parseInt(randomSuffix(userId).slice(0, 2), 16) % names.length

  return {
    user_id: userId,
    display_name: `${names[index]}-${randomSuffix(userId)}`,
    avatar_seed: crypto.createHash('md5').update(`avatar:${userId}`).digest('hex'),
  }
}

async function ensureAnonymousProfile(userId) {
  const rows = await postgrest(
    `anonymous_profiles?user_id=eq.${encodeURIComponent(userId)}&select=*`,
  )

  if (rows?.[0]) {
    return rows[0]
  }

  const created = await postgrest('anonymous_profiles', {
    method: 'POST',
    body: generateAnonymousProfile(userId),
  })

  return created[0]
}

function toEmotionRecord(userId, text, analysis, rawResult) {
  return {
    user_id: userId,
    input_text: text,
    primary_emotion: analysis.primaryEmotion,
    mixed_emotions: analysis.mixedEmotions,
    intensity: analysis.intensity,
    valence: analysis.valence,
    arousal: analysis.arousal,
    tendency: analysis.tendency,
    confidence: analysis.confidence,
    empathy_message: analysis.empathyMessage,
    raw_result: rawResult,
  }
}

function mapMessage(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    senderId: row.sender_id,
    senderAlias: row.sender_alias,
    content: row.content,
    createdAt: row.created_at,
  }
}

function mapMember(row) {
  return {
    roomId: row.room_id,
    userId: row.user_id,
    anonymousName: row.anonymous_name,
    avatarSeed: row.avatar_seed,
    emotionRecordId: row.emotion_record_id,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
  }
}

function mapRoom(row, members = [], currentUserId = '') {
  return {
    id: row.id,
    status: row.status,
    emotionSummary: row.emotion_summary || {},
    createdAt: row.created_at,
    closedAt: row.closed_at,
    currentUserId,
    members: members.map(mapMember),
  }
}

async function assertRoomMember(roomId, userId) {
  const memberships = await postgrest(
    `chat_room_members?room_id=eq.${encodeURIComponent(roomId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
  )
  const membership = memberships?.[0]

  if (!membership || membership.left_at) {
    const error = new Error('You are not a member of this room.')
    error.statusCode = 403
    error.errorCode = 'room_forbidden'
    throw error
  }

  return membership
}

async function getRoomForUser(roomId, userId) {
  await assertRoomMember(roomId, userId)

  const [rooms, members] = await Promise.all([
    postgrest(`chat_rooms?id=eq.${encodeURIComponent(roomId)}&select=*`),
    postgrest(`chat_room_members?room_id=eq.${encodeURIComponent(roomId)}&select=*`),
  ])

  if (!rooms?.[0]) {
    const error = new Error('Room not found.')
    error.statusCode = 404
    error.errorCode = 'room_not_found'
    throw error
  }

  return mapRoom(rooms[0], members || [], userId)
}

function scoreCandidate(analysis, candidate) {
  const emotionBonus = candidate.primary_emotion === analysis.primaryEmotion ? 0.35 : 0
  const intensityDistance = Math.abs(Number(candidate.intensity) - analysis.intensity)
  const valenceDistance = Math.abs(Number(candidate.valence) - analysis.valence) / 2
  const arousalDistance = Math.abs(Number(candidate.arousal) - analysis.arousal)

  return (
    emotionBonus +
    (1 - intensityDistance) * 0.25 +
    (1 - valenceDistance) * 0.25 +
    (1 - arousalDistance) * 0.15
  )
}

async function findBestCandidate(userId, analysis) {
  const rows = await postgrest(
    `match_queue?status=eq.queued&user_id=neq.${encodeURIComponent(userId)}&order=created_at.asc&limit=20&select=*`,
  )
  const scored = (rows || [])
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(analysis, candidate),
    }))
    .sort((a, b) => b.score - a.score)

  return scored[0]?.score >= 0.62 ? scored[0].candidate : null
}

async function createMatchedRoom(userId, emotionRecord, analysis, candidate, profile) {
  const [candidateProfileRows, candidateEmotionRows] = await Promise.all([
    postgrest(
      `anonymous_profiles?user_id=eq.${encodeURIComponent(candidate.user_id)}&select=*`,
    ),
    postgrest(
      `emotion_records?id=eq.${encodeURIComponent(candidate.emotion_record_id)}&select=*`,
    ),
  ])
  const candidateProfile =
    candidateProfileRows?.[0] || (await ensureAnonymousProfile(candidate.user_id))
  const candidateEmotion = candidateEmotionRows?.[0]
  const rooms = await postgrest('chat_rooms', {
    method: 'POST',
    body: {
      status: 'active',
      emotion_summary: {
        matchedBy: 'emotion_similarity',
        emotions: [
          analysis.primaryEmotion,
          candidateEmotion?.primary_emotion || candidate.primary_emotion,
        ],
        score: scoreCandidate(analysis, candidate),
      },
    },
  })
  const room = rooms[0]

  await postgrest('chat_room_members', {
    method: 'POST',
    body: [
      {
        room_id: room.id,
        user_id: userId,
        anonymous_name: profile.display_name,
        avatar_seed: profile.avatar_seed,
        emotion_record_id: emotionRecord.id,
      },
      {
        room_id: room.id,
        user_id: candidate.user_id,
        anonymous_name: candidateProfile.display_name,
        avatar_seed: candidateProfile.avatar_seed,
        emotion_record_id: candidate.emotion_record_id,
      },
    ],
  })
  await postgrest(
    `match_queue?id=eq.${encodeURIComponent(candidate.id)}`,
    {
      method: 'PATCH',
      body: {
        status: 'matched',
        room_id: room.id,
      },
    },
  )
  await postgrest('match_queue', {
    method: 'POST',
    body: {
      user_id: userId,
      emotion_record_id: emotionRecord.id,
      status: 'matched',
      primary_emotion: analysis.primaryEmotion,
      intensity: analysis.intensity,
      valence: analysis.valence,
      arousal: analysis.arousal,
      room_id: room.id,
    },
  })

  return getRoomForUser(room.id, userId)
}

async function getCurrentMatch(userId) {
  const rows = await postgrest(
    `match_queue?user_id=eq.${encodeURIComponent(userId)}&status=in.(queued,matched)&order=created_at.desc&limit=1&select=*`,
  )
  const current = rows?.[0]

  if (!current) {
    return { status: 'idle' }
  }

  if (current.status === 'matched' && current.room_id) {
    return {
      status: 'matched',
      queueId: current.id,
      room: await getRoomForUser(current.room_id, userId),
    }
  }

  return {
    status: 'queued',
    queueId: current.id,
    emotionRecordId: current.emotion_record_id,
    createdAt: current.created_at,
  }
}

app.post('/api/emotions/analyze', requireAuthenticatedUser, async (req, res, next) => {
  try {
    const text = validateEmotionText(req.body?.text)
    const result = await analyzeEmotion(text)

    res.json(result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/matches/join', requireAuthenticatedUser, async (req, res, next) => {
  try {
    const userId = req.user.id
    const text = validateEmotionText(req.body?.text)
    const profile = await ensureAnonymousProfile(userId)
    const emotionResult = req.body?.analysis
      ? {
          analysis: normalizeEmotionAnalysis(req.body.analysis),
          provider: 'client',
          mode: 'provided',
        }
      : await analyzeEmotion(text)
    const analysis = emotionResult.analysis
    const emotionRows = await postgrest('emotion_records', {
      method: 'POST',
      body: toEmotionRecord(userId, text, analysis, emotionResult),
    })
    const emotionRecord = emotionRows[0]

    await postgrest(
      `match_queue?user_id=eq.${encodeURIComponent(userId)}&status=eq.queued`,
      {
        method: 'PATCH',
        body: {
          status: 'cancelled',
        },
      },
    )

    const candidate = await findBestCandidate(userId, analysis)

    if (candidate) {
      const room = await createMatchedRoom(userId, emotionRecord, analysis, candidate, profile)

      return res.json({
        status: 'matched',
        analysis,
        emotionRecordId: emotionRecord.id,
        room,
      })
    }

    const queueRows = await postgrest('match_queue', {
      method: 'POST',
      body: {
        user_id: userId,
        emotion_record_id: emotionRecord.id,
        status: 'queued',
        primary_emotion: analysis.primaryEmotion,
        intensity: analysis.intensity,
        valence: analysis.valence,
        arousal: analysis.arousal,
      },
    })

    res.json({
      status: 'queued',
      queueId: queueRows[0].id,
      analysis,
      emotionRecordId: emotionRecord.id,
      profile: {
        displayName: profile.display_name,
        avatarSeed: profile.avatar_seed,
      },
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/matches/current', requireAuthenticatedUser, async (req, res, next) => {
  try {
    res.json(await getCurrentMatch(req.user.id))
  } catch (error) {
    next(error)
  }
})

app.get('/api/rooms/:roomId/messages', requireAuthenticatedUser, async (req, res, next) => {
  try {
    await assertRoomMember(req.params.roomId, req.user.id)
    const rows = await postgrest(
      `chat_messages?room_id=eq.${encodeURIComponent(req.params.roomId)}&order=created_at.asc&select=*`,
    )

    res.json({
      messages: (rows || []).map(mapMessage),
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/rooms/:roomId/messages', requireAuthenticatedUser, async (req, res, next) => {
  try {
    const content = String(req.body?.content || '').trim()

    if (!content) {
      return res.status(400).json({
        error: 'message_required',
        message: 'Message content is required.',
      })
    }

    if (content.length > 1000) {
      return res.status(400).json({
        error: 'message_too_long',
        message: 'Message content must be 1000 characters or fewer.',
      })
    }

    const membership = await assertRoomMember(req.params.roomId, req.user.id)
    const rooms = await postgrest(
      `chat_rooms?id=eq.${encodeURIComponent(req.params.roomId)}&status=eq.active&select=id`,
    )

    if (!rooms?.[0]) {
      return res.status(409).json({
        error: 'room_closed',
        message: 'This room is no longer active.',
      })
    }

    const rows = await postgrest('chat_messages', {
      method: 'POST',
      body: {
        room_id: req.params.roomId,
        sender_id: req.user.id,
        sender_alias: membership.anonymous_name,
        content,
      },
    })

    res.json({
      message: mapMessage(rows[0]),
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/rooms/:roomId/leave', requireAuthenticatedUser, async (req, res, next) => {
  try {
    await assertRoomMember(req.params.roomId, req.user.id)
    const now = new Date().toISOString()

    await postgrest(
      `chat_room_members?room_id=eq.${encodeURIComponent(req.params.roomId)}&user_id=eq.${encodeURIComponent(req.user.id)}`,
      {
        method: 'PATCH',
        body: {
          left_at: now,
        },
      },
    )
    await postgrest(`chat_rooms?id=eq.${encodeURIComponent(req.params.roomId)}`, {
      method: 'PATCH',
      body: {
        status: 'closed',
        closed_at: now,
      },
    })

    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.statusCode || 500).json({
    error: err.errorCode || 'internal_server_error',
    message: err.message,
  })
})

if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`social-service listening on ${port}`)
  })
}

module.exports = app
