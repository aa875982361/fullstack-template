import { Text, View } from '@tarojs/components'

type AnonymousAvatarProps = {
  name: string
  seed?: string
  size?: 'sm' | 'md'
}

function colorFromSeed(seed = '') {
  const palette = ['#7c3aed', '#0f766e', '#2563eb', '#db2777', '#ea580c', '#16a34a']
  const sum = seed.split('').reduce((total, char) => total + char.charCodeAt(0), 0)

  return palette[sum % palette.length]
}

export function AnonymousAvatar({ name, seed, size = 'md' }: AnonymousAvatarProps) {
  const dimension = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11'
  const initial = name.slice(0, 1) || '?'

  return (
    <View
      className={`${dimension} flex items-center justify-center rounded-2xl shadow-sm`}
      style={{ backgroundColor: colorFromSeed(seed || name) }}
    >
      <Text className='text-sm font-bold text-white'>{initial}</Text>
    </View>
  )
}
