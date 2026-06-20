import { useState } from 'react'
import { Button, Input, Text, View } from '@tarojs/components'
import { pingApi, sendDeepSeekMessage } from '../../services/api'
import './index.less'

export default function Index() {
  const [message, setMessage] = useState('hello')
  const [result, setResult] = useState('Ready')

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

  return (
    <View className='page'>
      <View className='header'>
        <Text className='title'>Lutra Fullstack Template</Text>
        <Text className='subtitle'>Taro frontend + Express microservices</Text>
      </View>

      <View className='toolbar'>
        <Button className='button' onClick={handlePing}>
          Ping API
        </Button>
      </View>

      <View className='panel'>
        <Input
          className='input'
          value={message}
          onInput={(event) => setMessage(event.detail.value)}
          placeholder='Message'
        />
        <Button className='button primary' onClick={handleChat}>
          Send To DeepSeek
        </Button>
      </View>

      <View className='result'>
        <Text selectable>{result}</Text>
      </View>
    </View>
  )
}
