import { Text, View } from '@tarojs/components'
import type { ChatMessage } from '../services/api'

type ChatBubbleProps = {
  message: ChatMessage
  isMine: boolean
}

function formatTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function ChatBubble({ message, isMine }: ChatBubbleProps) {
  return (
    <View className={`mb-4 flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <View className={`max-w-[78%] ${isMine ? 'items-end' : 'items-start'}`}>
        <Text
          className={`mb-1 block text-[11px] ${
            isMine ? 'text-right text-primary-500' : 'text-neutral-400'
          }`}
        >
          {message.senderAlias} · {formatTime(message.createdAt)}
        </Text>
        <View
          className={`rounded-3xl px-4 py-3 shadow-sm ${
            isMine
              ? 'rounded-br-md bg-primary-500 text-white'
              : 'rounded-bl-md bg-white text-neutral-800'
          }`}
        >
          <Text className='text-sm leading-6'>{message.content}</Text>
        </View>
      </View>
    </View>
  )
}
