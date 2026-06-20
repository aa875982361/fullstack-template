import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'
import { signInWithEmail, signUpWithEmail } from '../../services/api'

type AuthMode = 'signup' | 'signin'

export default function Login() {
  const [mode, setMode] = useState<AuthMode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('默认关闭邮箱验证，注册后会直接登录。')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const normalizedEmail = email.trim()

    if (!normalizedEmail || !password) {
      setMessage('请输入邮箱和密码')
      return
    }

    if (password.length < 6) {
      setMessage('密码至少需要 6 位')
      return
    }

    setSubmitting(true)
    setMessage(mode === 'signup' ? '正在注册...' : '正在登录...')

    try {
      if (mode === 'signup') {
        await signUpWithEmail(normalizedEmail, password)
      } else {
        await signInWithEmail(normalizedEmail, password)
      }

      Taro.reLaunch({ url: '/pages/index/index' })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='min-h-screen bg-neutral-50 px-5 py-8 font-sans text-neutral-700'>
      <View className='mb-8'>
        <Text className='block text-2xl font-bold leading-tight text-neutral-900'>
          邮箱登录
        </Text>
        <Text className='mt-2 block text-sm text-neutral-500'>
          使用 Supabase 邮箱账号访问接口
        </Text>
      </View>

      <View className='mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-panel'>
        <View className='mb-4 flex rounded-lg bg-neutral-100 p-1'>
          <Button
            className={`m-0 h-9 flex-1 rounded-md text-sm leading-9 ${
              mode === 'signup'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'bg-transparent text-neutral-500'
            }`}
            onClick={() => {
              setMode('signup')
              setMessage('默认关闭邮箱验证，注册后会直接登录。')
            }}
          >
            注册
          </Button>
          <Button
            className={`m-0 h-9 flex-1 rounded-md text-sm leading-9 ${
              mode === 'signin'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'bg-transparent text-neutral-500'
            }`}
            onClick={() => {
              setMode('signin')
              setMessage('请输入已注册邮箱和密码登录。')
            }}
          >
            登录
          </Button>
        </View>

        <Input
          className='mb-3 h-11 rounded-md border border-neutral-200 bg-white px-3 text-sm'
          value={email}
          type='text'
          placeholder='邮箱'
          onInput={(event) => setEmail(event.detail.value)}
        />
        <Input
          className='mb-4 h-11 rounded-md border border-neutral-200 bg-white px-3 text-sm'
          value={password}
          password
          placeholder='密码（至少 6 位）'
          onInput={(event) => setPassword(event.detail.value)}
        />

        <Button
          className='m-0 h-11 rounded-md bg-primary-500 text-sm leading-11 text-white'
          loading={submitting}
          disabled={submitting}
          onClick={handleSubmit}
        >
          {mode === 'signup' ? '注册并登录' : '登录'}
        </Button>
      </View>

      <View className='rounded-lg border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-600'>
        <Text>{message}</Text>
      </View>
    </View>
  )
}

