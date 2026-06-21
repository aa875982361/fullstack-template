import Taro from '@tarojs/taro'
import { API_BASE_URL, SUPABASE_ANON_KEY } from '../config/env'

const AUTH_TOKEN_KEY = 'auth.access_token'

type AuthSession = {
  access_token: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
}

type AuthResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  user?: unknown
  error?: string
  msg?: string
  message?: string
}

export type ImageGenerationResponse = {
  provider?: string
  mode?: string
  model?: string
  created?: number
  data?: Array<{
    url?: string
    b64_json?: string
    revised_prompt?: string
  }>
}

export type EmotionAnalysis = {
  primaryEmotion: string
  mixedEmotions: Array<{
    label: string
    score: number
  }>
  intensity: number
  valence: number
  arousal: number
  tendency: string
  confidence: number
  empathyMessage: string
}

export type AnalyzeEmotionResponse = {
  analysis: EmotionAnalysis
  provider: string
  mode: string
}

export type AnonymousProfile = {
  displayName?: string
  avatarSeed?: string
}

export type ChatRoomMember = {
  roomId: string
  userId: string
  anonymousName: string
  avatarSeed: string
  emotionRecordId?: string
  joinedAt: string
  leftAt?: string
}

export type ChatRoom = {
  id: string
  status: 'active' | 'closed'
  emotionSummary: Record<string, unknown>
  createdAt: string
  closedAt?: string
  currentUserId?: string
  members: ChatRoomMember[]
}

export type MatchResponse = {
  status: 'queued' | 'matched'
  analysis: EmotionAnalysis
  emotionRecordId: string
  queueId?: string
  profile?: AnonymousProfile
  room?: ChatRoom
}

export type CurrentMatchResponse =
  | {
      status: 'idle'
    }
  | {
      status: 'queued'
      queueId: string
      emotionRecordId: string
      createdAt: string
    }
  | {
      status: 'matched'
      queueId: string
      room: ChatRoom
    }

export type ChatMessage = {
  id: string
  roomId: string
  senderId: string
  senderAlias: string
  content: string
  createdAt: string
}

export type RoomMessagesResponse = {
  messages: ChatMessage[]
}

export function getAccessToken() {
  return Taro.getStorageSync<string>(AUTH_TOKEN_KEY)
}

function setAccessToken(token: string) {
  Taro.setStorageSync(AUTH_TOKEN_KEY, token)
}

export function clearAccessToken() {
  Taro.removeStorageSync(AUTH_TOKEN_KEY)
}

export function hasAccessToken() {
  return Boolean(getAccessToken())
}

function redirectToLogin() {
  const pages = Taro.getCurrentPages()
  const currentRoute = pages[pages.length - 1]?.route

  if (currentRoute === 'pages/login/index') {
    return
  }

  Taro.reLaunch({ url: '/pages/login/index' })
}

function getErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === 'object') {
    const payload = data as { message?: unknown; msg?: unknown; error?: unknown }
    const message = payload.message || payload.msg || payload.error

    if (typeof message === 'string') {
      return message
    }
  }

  return fallback
}

async function requestApi<T>(
  path: string,
  options: Omit<Taro.request.Option, 'url'> = {},
) {
  const token = getAccessToken()
  const header = {
    ...(options.header || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const response = await Taro.request<T>({
    ...options,
    url: `${API_BASE_URL}${path}`,
    header,
  })

  if (response.statusCode === 401) {
    clearAccessToken()
    redirectToLogin()
    throw new Error('登录已失效，请重新登录')
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(getErrorMessage(response.data, `请求失败：${response.statusCode}`))
  }

  return response.data
}

async function requestAuth<T extends AuthResponse>(
  path: string,
  data: Record<string, unknown>,
) {
  if (!SUPABASE_ANON_KEY) {
    throw new Error('缺少 TARO_APP_SUPABASE_ANON_KEY 配置')
  }

  const response = await Taro.request<T>({
    url: `${API_BASE_URL}${path}`,
    method: 'POST',
    header: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
    },
    data,
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(getErrorMessage(response.data, '邮箱或密码不正确'))
  }

  if (!response.data?.access_token) {
    throw new Error('注册成功，请先完成邮箱验证后再登录')
  }

  setAccessToken(response.data.access_token)

  return response.data as T & AuthSession
}

export async function pingApi() {
  return requestApi('/api/ping', {
    method: 'GET',
  })
}

export async function sendDeepSeekMessage(message: string) {
  return requestApi('/deepseek/v1/chat', {
    method: 'POST',
    header: {
      'content-type': 'application/json',
    },
    data: {
      message,
    },
  })
}

export async function generateImage(prompt: string) {
  return requestApi<ImageGenerationResponse>('/images/v1/generations', {
    method: 'POST',
    header: {
      'content-type': 'application/json',
    },
    data: {
      prompt,
      sequential_image_generation: 'disabled',
      response_format: 'url',
      size: '2K',
      stream: false,
      watermark: true,
    },
  })
}

export async function analyzeEmotion(text: string) {
  return requestApi<AnalyzeEmotionResponse>('/social/v1/emotions/analyze', {
    method: 'POST',
    header: {
      'content-type': 'application/json',
    },
    data: {
      text,
    },
  })
}

export async function joinEmotionMatch(text: string, analysis?: EmotionAnalysis) {
  return requestApi<MatchResponse>('/social/v1/matches/join', {
    method: 'POST',
    header: {
      'content-type': 'application/json',
    },
    data: {
      text,
      ...(analysis ? { analysis } : {}),
    },
  })
}

export async function getCurrentMatch() {
  return requestApi<CurrentMatchResponse>('/social/v1/matches/current', {
    method: 'GET',
  })
}

export async function getRoomMessages(roomId: string) {
  return requestApi<RoomMessagesResponse>(
    `/social/v1/rooms/${encodeURIComponent(roomId)}/messages`,
    {
      method: 'GET',
    },
  )
}

export async function sendRoomMessage(roomId: string, content: string) {
  return requestApi<{ message: ChatMessage }>(
    `/social/v1/rooms/${encodeURIComponent(roomId)}/messages`,
    {
      method: 'POST',
      header: {
        'content-type': 'application/json',
      },
      data: {
        content,
      },
    },
  )
}

export async function leaveRoom(roomId: string) {
  return requestApi<{ ok: boolean }>(
    `/social/v1/rooms/${encodeURIComponent(roomId)}/leave`,
    {
      method: 'POST',
    },
  )
}

export async function signInWithEmail(email: string, password: string) {
  return requestAuth('/auth/v1/token?grant_type=password', {
    email,
    password,
  })
}

export async function signUpWithEmail(email: string, password: string) {
  return requestAuth('/auth/v1/signup', {
    email,
    password,
  })
}
