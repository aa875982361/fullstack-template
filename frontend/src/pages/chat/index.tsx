import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, ScrollView, Text, View } from '@tarojs/components'
import { AnonymousAvatar } from '../../components/AnonymousAvatar'
import { ChatBubble } from '../../components/ChatBubble'
import {
  getCurrentMatch,
  getRoomMessages,
  leaveRoom,
  sendRoomMessage,
  type ChatMessage,
  type ChatRoom,
} from '../../services/api'
import { subscribeRoomMessages } from '../../services/realtime'

function mergeMessage(list: ChatMessage[], message: ChatMessage) {
  if (list.some((item) => item.id === message.id)) {
    return list
  }

  return [...list, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export default function ChatPage() {
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [statusText, setStatusText] = useState('正在进入匿名房间...')
  const [sending, setSending] = useState(false)

  const roomId = Taro.getCurrentInstance().router?.params?.roomId || ''
  const selfId = room?.currentUserId || ''
  const partner = useMemo(
    () => room?.members.find((member) => member.userId !== selfId),
    [room, selfId],
  )

  useEffect(() => {
    if (!roomId) {
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }

    let unsubscribe: (() => void) | undefined
    let stopped = false

    async function resolveRoom() {
      const storedRoom = Taro.getStorageSync<ChatRoom>('emotion.active_room')

      if (storedRoom?.id === roomId) {
        return storedRoom
      }

      const current = await getCurrentMatch()

      if (current.status === 'matched' && current.room.id === roomId) {
        Taro.setStorageSync('emotion.active_room', current.room)
        return current.room
      }

      throw new Error('没有找到当前房间，请重新匹配。')
    }

    async function start() {
      try {
        const nextRoom = await resolveRoom()
        const data = await getRoomMessages(roomId)

        if (stopped) {
          return
        }

        setRoom(nextRoom)
        setMessages(data.messages)
        setStatusText('Realtime 已连接，开始匿名对话。')
        unsubscribe = subscribeRoomMessages(
          roomId,
          (message) => {
            setMessages((items) => mergeMessage(items, message))
          },
          setStatusText,
        )
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : String(error))
      }
    }

    start()

    return () => {
      stopped = true
      unsubscribe?.()
    }
  }, [roomId])

  async function handleSend() {
    const content = draft.trim()

    if (!content || sending) {
      return
    }

    setSending(true)

    try {
      const data = await sendRoomMessage(roomId, content)

      setDraft('')
      setMessages((items) => mergeMessage(items, data.message))
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : String(error))
    } finally {
      setSending(false)
    }
  }

  async function handleLeave() {
    try {
      await leaveRoom(roomId)
      Taro.removeStorageSync('emotion.active_room')
      Taro.redirectTo({ url: '/pages/index/index' })
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <View className='flex min-h-screen flex-col bg-[#f7f3ee] px-5 py-6 font-sans text-neutral-700'>
      <View className='mb-4 rounded-3xl bg-neutral-900 p-5 text-white shadow-panel'>
        <View className='mb-4 flex items-center justify-between'>
          <View>
            <Text className='block text-xl font-bold text-white'>匿名情绪房间</Text>
            <Text className='mt-1 block text-xs text-neutral-300'>
              {room?.status === 'active' ? '对话中' : '房间已关闭'}
            </Text>
          </View>
          <Button
            className='m-0 h-9 rounded-full bg-white/10 px-4 text-xs leading-9 text-white'
            onClick={handleLeave}
          >
            离开
          </Button>
        </View>

        <View className='flex items-center gap-3'>
          {partner ? (
            <>
              <AnonymousAvatar
                name={partner.anonymousName}
                seed={partner.avatarSeed}
                size='sm'
              />
              <View>
                <Text className='block text-sm font-semibold text-white'>
                  正在和 {partner.anonymousName} 对话
                </Text>
                <Text className='mt-1 block text-xs leading-5 text-neutral-300'>
                  你们因为相近的情绪强度和状态被匹配到一起。
                </Text>
              </View>
            </>
          ) : (
            <Text className='text-sm text-neutral-300'>正在读取匿名成员...</Text>
          )}
        </View>
      </View>

      <Text className='mb-3 block rounded-2xl bg-white/80 p-3 text-xs leading-5 text-neutral-500'>
        {statusText}
      </Text>

      <ScrollView
        className='mb-4 min-h-0 flex-1 rounded-3xl bg-white/40 p-4'
        scrollY
        scrollIntoView='message-bottom'
      >
        {messages.length ? (
          messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              isMine={message.senderId === selfId}
            />
          ))
        ) : (
          <View className='rounded-3xl bg-white p-5 text-center'>
            <Text className='text-sm leading-6 text-neutral-500'>
              还没有消息。可以从“我刚刚写下那段话时，其实最想被理解的是...”开始。
            </Text>
          </View>
        )}
        <View id='message-bottom' className='h-1' />
      </ScrollView>

      <View className='flex items-center gap-3 rounded-3xl bg-white p-3 shadow-panel'>
        <Input
          className='h-11 flex-1 rounded-full bg-neutral-50 px-4 text-sm'
          value={draft}
          placeholder='匿名说点什么...'
          onInput={(event) => setDraft(event.detail.value)}
          confirmType='send'
          onConfirm={handleSend}
        />
        <Button
          className='m-0 h-11 rounded-full bg-primary-500 px-5 text-sm leading-11 text-white'
          loading={sending}
          disabled={sending}
          onClick={handleSend}
        >
          发送
        </Button>
      </View>
    </View>
  )
}
