export const API_BASE_URL =
  (process.env.TARO_APP_API_BASE_URL || 'http://127.0.0.1:8000').replace(
    /\/$/,
    '',
  )

export const H5_BASE_URL =
  process.env.TARO_APP_H5_BASE_URL || 'http://127.0.0.1:10086'

export const SUPABASE_URL = (
  process.env.TARO_APP_SUPABASE_URL ||
  process.env.TARO_APP_API_BASE_URL ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '')

export const SUPABASE_ANON_KEY = process.env.TARO_APP_SUPABASE_ANON_KEY || ''
