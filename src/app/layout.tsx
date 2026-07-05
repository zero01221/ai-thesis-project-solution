import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: '毕业设计 AI 助手 | 从需求到代码',
  description: '输入毕业论文题目，AI自动生成需求、README文档和完整项目代码，一键下载可运行压缩包',
  keywords: [
    '毕业设计',
    '毕业论文',
    'AI代码生成',
    '需求分析',
    'README生成',
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
