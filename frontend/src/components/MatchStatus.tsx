import { Text, View } from '@tarojs/components'

type MatchStatusProps = {
  status: 'idle' | 'analyzing' | 'queued' | 'matched' | 'error'
  message?: string
}

const statusCopy: Record<MatchStatusProps['status'], string> = {
  idle: '等待你的情绪信号',
  analyzing: 'AI 正在理解这段感受',
  queued: '正在寻找相近频率的人',
  matched: '匹配成功，匿名房间已准备好',
  error: '匹配遇到问题',
}

export function MatchStatus({ status, message }: MatchStatusProps) {
  return (
    <View className='rounded-3xl border border-neutral-200 bg-white p-5 shadow-panel'>
      <View className='mb-3 flex items-center gap-3'>
        <View className='h-3 w-3 rounded-full bg-primary-500' />
        <Text className='text-base font-semibold text-neutral-900'>{statusCopy[status]}</Text>
      </View>
      <Text className='block text-sm leading-6 text-neutral-500'>
        {message ||
          '我们会优先参考主情绪、强度、效价与唤醒度，而不是简单按关键词把你放进聊天室。'}
      </Text>
    </View>
  )
}
