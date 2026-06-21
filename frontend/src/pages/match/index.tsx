import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import { EmotionCard } from '../../components/EmotionCard'
import { MatchStatus } from '../../components/MatchStatus'
import {
  getCurrentMatch,
  joinEmotionMatch,
  type ChatRoom,
  type EmotionAnalysis,
} from '../../services/api'

type MatchDraft = {
  text: string
  analysis: EmotionAnalysis
}

type MatchPhase = 'idle' | 'analyzing' | 'queued' | 'matched' | 'error'

export default function MatchPage() {
  const [draft, setDraft] = useState<MatchDraft | null>(null)
  const [phase, setPhase] = useState<MatchPhase>('idle')
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [message, setMessage] = useState('准备读取你的情绪画像。')

  useEffect(() => {
    const storedDraft = Taro.getStorageSync<MatchDraft>('emotion.match_draft')

    if (!storedDraft?.text || !storedDraft.analysis) {
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }

    setDraft(storedDraft)

    let stopped = false
    let timer: ReturnType<typeof setInterval> | undefined

    function handleMatched(nextRoom: ChatRoom) {
      Taro.setStorageSync('emotion.active_room', nextRoom)
      setRoom(nextRoom)
      setPhase('matched')
      setMessage('已经找到一个相近情绪频率的人，可以进入匿名对话。')
    }

    async function pollCurrentMatch() {
      const current = await getCurrentMatch()

      if (stopped) {
        return
      }

      if (current.status === 'matched') {
        if (timer) {
          clearInterval(timer)
        }
        handleMatched(current.room)
      }
    }

    async function startMatch() {
      setPhase('analyzing')
      setMessage('正在把情绪画像送入匹配队列。')

      try {
        const result = await joinEmotionMatch(storedDraft.text, storedDraft.analysis)

        if (stopped) {
          return
        }

        if (result.status === 'matched' && result.room) {
          handleMatched(result.room)
          return
        }

        setPhase('queued')
        setMessage('你已进入队列。我们会持续寻找主情绪和强度相近的人。')
        timer = setInterval(() => {
          pollCurrentMatch().catch((error) => {
            setPhase('error')
            setMessage(error instanceof Error ? error.message : String(error))
          })
        }, 3000)
      } catch (error) {
        setPhase('error')
        setMessage(error instanceof Error ? error.message : String(error))
      }
    }

    startMatch()

    return () => {
      stopped = true
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [])

  function enterRoom() {
    if (!room) {
      return
    }

    Taro.navigateTo({ url: `/pages/chat/index?roomId=${encodeURIComponent(room.id)}` })
  }

  return (
    <View className='min-h-screen bg-[#f7f3ee] px-5 py-8 font-sans text-neutral-700'>
      <View className='mb-6'>
        <Text className='block text-2xl font-bold text-neutral-900'>情绪匹配中</Text>
        <Text className='mt-2 block text-sm leading-6 text-neutral-500'>
          匹配不是随机进入房间，而是按 AI 情绪画像寻找能理解此刻状态的人。
        </Text>
      </View>

      <View className='mb-5'>
        <MatchStatus status={phase} message={message} />
      </View>

      {draft ? (
        <View className='mb-5'>
          <EmotionCard analysis={draft.analysis} title='用于匹配的情绪画像' />
        </View>
      ) : null}

      {room ? (
        <View className='rounded-3xl border border-primary-100 bg-white p-5 shadow-panel'>
          <Text className='block text-lg font-semibold text-neutral-900'>
            匿名房间已创建
          </Text>
          <Text className='mt-2 block text-sm leading-6 text-neutral-500'>
            房间中只显示匿名昵称。你们可以从这份共同的情绪背景开始，不需要暴露真实身份。
          </Text>
          <Button
            className='mt-5 m-0 h-12 rounded-full bg-primary-500 text-sm leading-12 text-white'
            onClick={enterRoom}
          >
            进入匿名对话
          </Button>
        </View>
      ) : null}
    </View>
  )
}
