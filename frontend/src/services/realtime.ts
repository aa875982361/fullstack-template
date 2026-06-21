import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/env'
import { getAccessToken, type ChatMessage } from './api'

let client: SupabaseClient | null = null

function getClient() {
  if (!SUPABASE_ANON_KEY) {
    throw new Error('缺少 TARO_APP_SUPABASE_ANON_KEY 配置')
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  const token = getAccessToken()

  if (token) {
    client.realtime.setAuth(token)
  }

  return client
}

function mapRealtimeMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id || ''),
    roomId: String(row.room_id || ''),
    senderId: String(row.sender_id || ''),
    senderAlias: String(row.sender_alias || ''),
    content: String(row.content || ''),
    createdAt: String(row.created_at || ''),
  }
}

export function subscribeRoomMessages(
  roomId: string,
  onMessage: (message: ChatMessage) => void,
  onError?: (message: string) => void,
) {
  const realtimeClient = getClient()
  const channel = realtimeClient
    .channel(`chat-room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        onMessage(mapRealtimeMessage(payload.new as Record<string, unknown>))
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.(`Realtime 订阅失败：${status}`)
      }
    })

  return () => {
    realtimeClient.removeChannel(channel)
  }
}
