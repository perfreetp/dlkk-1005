import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'
import App from './App'
import './styles/global.css'

dayjs.locale('zh-cn')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: antdTheme.darkAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          colorInfo: '#1890ff',
          colorBgContainer: '#141414',
          colorBgElevated: '#1f1f1f',
          colorBorder: '#303030',
          colorBorderSecondary: '#2a2a2a',
          borderRadius: 6,
          fontSize: 13,
          colorText: '#e0e0e0',
          colorTextSecondary: '#a0a0a0',
          colorTextTertiary: '#707070',
        },
        components: {
          Table: {
            headerBg: '#1a1a1a',
            rowHoverBg: '#1f2937',
            borderColor: '#303030',
          },
          Button: {
            colorBorder: '#404040',
          },
          Input: {
            colorBorder: '#404040',
            colorBgContainer: '#141414',
          },
          Select: {
            colorBorder: '#404040',
            colorBgContainer: '#141414',
          },
          Tabs: {
            itemSelectedColor: '#1890ff',
            itemHoverColor: '#40a9ff',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
