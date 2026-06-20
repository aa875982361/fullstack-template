/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/index.html', './src/**/*.{html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef6ff',
          100: '#d9ecff',
          500: '#1f6feb',
          600: '#185abc',
          700: '#123f86',
        },
        neutral: {
          50: '#f7f8fa',
          100: '#eef0f3',
          200: '#d7dce2',
          500: '#68717d',
          700: '#20242a',
          900: '#111418',
        },
      },
      fontFamily: {
        sans: ['PingFang SC', 'SF Pro Text', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        panel: '0 12px 32px rgba(17, 20, 24, 0.08)',
      },
    },
  },
  corePlugins: {
    preflight: process.env.TARO_ENV === 'h5',
  },
}

