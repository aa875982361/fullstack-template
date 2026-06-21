import { Text, View } from '@tarojs/components'

type EmotionMeterProps = {
  label: string
  value: number
  minLabel?: string
  maxLabel?: string
}

export function EmotionMeter({ label, value, minLabel, maxLabel }: EmotionMeterProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)

  return (
    <View className='mb-3'>
      <View className='mb-1 flex items-center justify-between'>
        <Text className='text-xs text-neutral-500'>{label}</Text>
        <Text className='text-xs font-semibold text-neutral-700'>{percent}%</Text>
      </View>
      <View className='h-2 overflow-hidden rounded-full bg-neutral-100'>
        <View
          className='h-2 rounded-full bg-primary-500'
          style={{ width: `${percent}%` }}
        />
      </View>
      {(minLabel || maxLabel) && (
        <View className='mt-1 flex justify-between'>
          <Text className='text-[10px] text-neutral-400'>{minLabel}</Text>
          <Text className='text-[10px] text-neutral-400'>{maxLabel}</Text>
        </View>
      )}
    </View>
  )
}
