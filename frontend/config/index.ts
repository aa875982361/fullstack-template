import { defineConfig, type UserConfigExport } from '@tarojs/cli'

const { UnifiedWebpackPluginV5 } = require('weapp-tailwindcss/webpack')

export default defineConfig<'webpack5'>(async () => {
  const config: UserConfigExport<'webpack5'> = {
    projectName: 'lutra-template-frontend',
    date: '2026-06-19',
    designWidth: 375,
    deviceRatio: {
      375: 2,
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: {
        enable: false,
      },
    },
    defineConstants: {
      'process.env.TARO_APP_API_BASE_URL': JSON.stringify(
        process.env.TARO_APP_API_BASE_URL || '',
      ),
      'process.env.TARO_APP_H5_BASE_URL': JSON.stringify(
        process.env.TARO_APP_H5_BASE_URL || '',
      ),
    },
    mini: {
      webpackChain(chain) {
        chain.merge({
          plugin: {
            install: {
              plugin: UnifiedWebpackPluginV5,
              args: [
                {
                  appType: 'taro',
                  rem2rpx: true,
                },
              ],
            },
          },
        })
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false,
        },
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      router: {
        mode: 'hash',
      },
      postcss: {
        autoprefixer: {
          enable: true,
        },
        cssModules: {
          enable: false,
        },
      },
    },
  }

  return config
})
