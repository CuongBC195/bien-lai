import type { Metadata } from "next";
import { Tinos } from "next/font/google";
import "./globals.css";

const tinos = Tinos({
  weight: ['400', '700'],
  subsets: ["latin", "vietnamese"],
  display: 'swap',
  variable: '--font-tinos',
});

export const metadata: Metadata = {
  title: "Quản lý Biên Nhận Tiền",
  description: "Ứng dụng quản lý và tạo giấy biên nhận tiền, hỗ trợ ký tên online và xuất file PDF",
  keywords: ['biên nhận', 'biên lai', 'receipt', 'pdf', 'ký tên', 'quản lý'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${tinos.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
