import type { Metadata } from 'next';
import { Nav } from '../components/Nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Graph RAG',
  description: 'Knowledge graph + semantic retrieval chat',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
