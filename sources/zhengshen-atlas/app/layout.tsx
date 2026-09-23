import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'征神图鉴 · 永劫无间征神之路',description:'检索征神之路魂玉、天赋与词条。S6 红砂资料持续整理中。'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN" className="dark"><body>{children}</body></html>}
