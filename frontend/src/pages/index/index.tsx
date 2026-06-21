import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Image, Input, Text, View } from '@tarojs/components'
import {
  clearAccessToken,
  generateImage,
  hasAccessToken,
  pingApi,
  sendDeepSeekMessage,
} from '../../services/api'

export default function Index() {
  const [message, setMessage] = useState('hello')
  const [imagePrompt, setImagePrompt] = useState(
    '星际穿越，黑洞，黑洞里冲出一辆快支离破碎的复古列车，电影大片',
  )
  const [imageUrl, setImageUrl] = useState('')
  const [result, setResult] = useState('Ready')
  const [isLoggedIn, setIsLoggedIn] = useState(hasAccessToken())

  async function handlePing() {
    try {
      const data = await pingApi()
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleChat() {
    try {
      const data = await sendDeepSeekMessage(message)
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleGenerateImage() {
    try {
      setImageUrl('')
      setResult('正在生成图片...')
      const data = await generateImage(imagePrompt)
      const url = data.data?.[0]?.url || ''

      setImageUrl(url)
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error))
    }
  }

  function handleLogin() {
    Taro.navigateTo({ url: '/pages/login/index' })
  }

  function handleLogout() {
    clearAccessToken()
    setIsLoggedIn(false)
    setResult('已退出登录')
  }

  return (
    <View className='min-h-screen bg-neutral-50 px-5 py-8 font-sans text-neutral-700'>
      <View className='mb-7'>
        <Text className='block text-2xl font-bold leading-tight text-neutral-900'>
          Lutra Fullstack Template
        </Text>
        <Text className='mt-2 block text-sm text-neutral-500'>
          Taro frontend + Supabase + Kong + Express microservices
        </Text>
      </View>

      <View className='mb-4 flex gap-3'>
        <Button
          className='m-0 h-10 rounded-md border border-neutral-200 bg-white px-4 text-sm leading-10 text-neutral-700'
          onClick={handlePing}
        >
          Ping API
        </Button>
        <Button
          className='m-0 h-10 rounded-md border border-neutral-200 bg-white px-4 text-sm leading-10 text-neutral-700'
          onClick={isLoggedIn ? handleLogout : handleLogin}
        >
          {isLoggedIn ? '退出登录' : '邮箱登录'}
        </Button>
      </View>

      <View className='mb-4 flex items-center gap-3'>
        <Input
          className='h-10 flex-1 rounded-md border border-neutral-200 bg-white px-3 text-sm'
          value={message}
          onInput={(event) => setMessage(event.detail.value)}
          placeholder='Message'
        />
        <Button
          className='m-0 h-10 rounded-md bg-primary-500 px-4 text-sm leading-10 text-white'
          onClick={handleChat}
        >
          Send To DeepSeek
        </Button>
      </View>

      <View className='mb-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-panel'>
        <Text className='mb-3 block text-base font-semibold text-neutral-900'>
          文生图示例
        </Text>
        <Input
          className='mb-3 h-10 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm'
          value={imagePrompt}
          onInput={(event) => setImagePrompt(event.detail.value)}
          placeholder='请输入图片 prompt'
        />
        <Button
          className='m-0 h-10 rounded-md bg-primary-500 px-4 text-sm leading-10 text-white'
          onClick={handleGenerateImage}
        >
          生成图片
        </Button>
        {imageUrl ? (
          <Image
            className='mt-4 h-72 w-full rounded-lg bg-neutral-100'
            mode='aspectFit'
            src={imageUrl}
          />
        ) : null}
      </View>

      <View className='min-h-40 whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-700 shadow-panel'>
        <Text selectable>{result}</Text>
      </View>
    </View>
  )
}
