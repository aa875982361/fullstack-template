import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Text, Textarea, View } from '@tarojs/components'
import { EmotionCard } from '../../components/EmotionCard'
import {
  analyzeEmotion,
  clearAccessToken,
  type EmotionAnalysis,
  hasAccessToken,
} from '../../services/api'

export default function Index() {
  const [emotionText, setEmotionText] = useState('')
  const [analysis, setAnalysis] = useState<EmotionAnalysis | null>(null)
  const [statusText, setStatusText] = useState('写下此刻真实的感受，AI 会先理解你，再为你寻找相近频率的人。')
  const [isLoggedIn, setIsLoggedIn] = useState(hasAccessToken())
  const [submitting, setSubmitting] = useState(false)

  function ensureLoggedIn() {
    if (!isLoggedIn) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return false
    }

    return true
  }

  async function handleAnalyze() {
    const text = emotionText.trim()

    if (!ensureLoggedIn()) {
      return null
    }

    if (!text) {
      setStatusText('先写一点你此刻的感受，可以很短，也可以很乱。')
      return null
    }

    setSubmitting(true)
    setStatusText('AI 正在识别情绪类型、强度和倾向...')

    try {
      const data = await analyzeEmotion(text)

      setAnalysis(data.analysis)
      setStatusText('情绪画像已生成，可以开始匹配匿名对话对象。')
      return data.analysis
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : String(error))
      return null
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStartMatch() {
    const text = emotionText.trim()

    if (!text) {
      setStatusText('请先写下你想被理解的那部分感受。')
      return
    }

    const nextAnalysis = analysis || (await handleAnalyze())

    if (!nextAnalysis) {
      return
    }

    Taro.setStorageSync('emotion.match_draft', {
      text,
      analysis: nextAnalysis,
    })
    Taro.navigateTo({ url: '/pages/match/index' })
  }

  function handleLogin() {
    Taro.navigateTo({ url: '/pages/login/index' })
  }

  function handleLogout() {
    clearAccessToken()
    setIsLoggedIn(false)
    setAnalysis(null)
    setStatusText('已退出登录。重新登录后可以继续匿名匹配。')
  }

  return (
    <View className='min-h-screen bg-[#f7f3ee] px-5 py-8 font-sans text-neutral-700'>
      <View className='mb-8 rounded-[32px] bg-neutral-900 px-5 py-7 text-white shadow-panel'>
        <Text className='mb-3 block text-sm text-primary-100'>AI 情绪社交</Text>
        <Text className='block text-3xl font-bold leading-tight text-white'>
          被理解之后，再进入匿名对话
        </Text>
        <Text className='mt-4 block text-sm leading-6 text-neutral-200'>
          情绪回声会先识别你的当下状态，再根据情绪相似度匹配对话对象。
          这里不是公开聊天室，只有相近频率的人会进入同一个房间。
        </Text>
      </View>

      <View className='mb-5 flex gap-3'>
        <Button
          className='m-0 h-10 rounded-full border border-neutral-200 bg-white px-4 text-sm leading-10 text-neutral-700'
          onClick={isLoggedIn ? handleLogout : handleLogin}
        >
          {isLoggedIn ? '退出登录' : '邮箱登录后匿名匹配'}
        </Button>
      </View>

      <View className='mb-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-panel'>
        <Text className='mb-3 block text-lg font-semibold text-neutral-900'>
          此刻的你是什么感觉？
        </Text>
        <Textarea
          className='min-h-36 w-full rounded-2xl bg-neutral-50 p-4 text-sm leading-6 text-neutral-800'
          value={emotionText}
          maxlength={1000}
          placeholder='例如：我今天一直很焦虑，明明没发生什么大事，但心里像悬着一样...'
          onInput={(event) => {
            setEmotionText(event.detail.value)
            setAnalysis(null)
          }}
        />
        <Text className='mt-3 block text-xs leading-5 text-neutral-400'>
          AI 会提取主情绪、复合情绪、强度、效价和倾向，用于匹配，不会把原文公开成动态。
        </Text>
      </View>

      <View className='mb-5 flex gap-3'>
        <Button
          className='m-0 h-12 flex-1 rounded-full border border-primary-100 bg-white text-sm leading-12 text-primary-600'
          loading={submitting}
          disabled={submitting}
          onClick={handleAnalyze}
        >
          先识别情绪
        </Button>
        <Button
          className='m-0 h-12 flex-1 rounded-full bg-primary-500 text-sm leading-12 text-white'
          loading={submitting}
          disabled={submitting}
          onClick={handleStartMatch}
        >
          开始匹配
        </Button>
      </View>

      {analysis ? <EmotionCard analysis={analysis} /> : null}

      <View className='mt-5 rounded-3xl bg-white/80 p-4 text-sm leading-6 text-neutral-500'>
        <Text>{statusText}</Text>
      </View>
    </View>
  )
}
