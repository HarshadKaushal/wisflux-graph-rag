'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home' },
  { href: '/upload', label: 'Upload' },
  { href: '/chat', label: 'Chat' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="nav">
      <Link href="/" className="nav-brand">
        Graph RAG
      </Link>
      <nav className="nav-links">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? 'nav-link active' : 'nav-link'}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
