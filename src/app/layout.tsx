import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '招标信息监控 | 云南省铁塔行业',
  description: '云南省铁塔制造及维修行业招标信息自动采集与推送工具',
  keywords: ['招标信息', '铁塔', '云南省', '招投标', '监控'],
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
