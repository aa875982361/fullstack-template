import Taro from '@tarojs/taro'
import { API_BASE_URL } from '../config/env'

export async function pingApi() {
  const response = await Taro.request({
    url: `${API_BASE_URL}/api/ping`,
    method: 'GET',
  })

  return response.data
}

export async function sendDeepSeekMessage(message: string) {
  const response = await Taro.request({
    url: `${API_BASE_URL}/api/deepseek/chat`,
    method: 'POST',
    header: {
      'content-type': 'application/json',
    },
    data: {
      message,
    },
  })

  return response.data
}
