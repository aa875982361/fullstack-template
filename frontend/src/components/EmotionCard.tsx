import { Text, View } from '@tarojs/components'
import type { EmotionAnalysis } from '../services/api'
import { EmotionMeter } from './EmotionMeter'

const emotionLabels: Record<string, string> = {
  anxious: '焦虑',
  sad: '低落',
  angry: '愤怒',
  lonely: '孤独',
  happy: '愉悦',
  calm: '平静',
  hopeful: '期待',
  confused: '困惑',
  tired: '疲惫',
  mixed: '复合情绪',
}

export function getEmotionLabel(value: string) {
  return emotionLabels[value] || value
}

type EmotionCardProps = {
  analysis: EmotionAnalysis
  title?: string
}

export function EmotionCard({ analysis, title = 'AI 情绪画像' }: EmotionCardProps) {
  const valenceValue = (analysis.valence + 1) / 2

  return (
    <View className='rounded-3xl border border-primary-100 bg-white p-5 shadow-panel'>
      <Text className='mb-2 block text-sm font-semibold text-primary-600'>{title}</Text>
      <View className='mb-4 flex items-end justify-between'>
        <View>
          <Text className='block text-3xl font-bold text-neutral-900'>
            {getEmotionLabel(analysis.primaryEmotion)}
          </Text>
          <Text className='mt-1 block text-xs text-neutral-500'>
            置信度 {Math.round(analysis.confidence * 100)}%
          </Text>
        </View>
        <Text className='rounded-full bg-primary-50 px-3 py-1 text-xs text-primary-600'>
          {analysis.tendency}
        </Text>
      </View>

      <Text className='mb-4 block rounded-2xl bg-neutral-50 p-3 text-sm leading-6 text-neutral-700'>
        {analysis.empathyMessage}
      </Text>

      <EmotionMeter label='情绪强度' value={analysis.intensity} minLabel='轻微' maxLabel='强烈' />
      <EmotionMeter label='情绪效价' value={valenceValue} minLabel='低落' maxLabel='积极' />
      <EmotionMeter label='唤醒程度' value={analysis.arousal} minLabel='安静' maxLabel='激活' />

      <View className='mt-3 flex flex-wrap gap-2'>
        {analysis.mixedEmotions.map((emotion) => (
          <Text
            key={`${emotion.label}-${emotion.score}`}
            className='rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600'
          >
            {getEmotionLabel(emotion.label)} {Math.round(emotion.score * 100)}%
          </Text>
        ))}
      </View>
    </View>
  )
}
