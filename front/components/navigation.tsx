'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, Rss, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const navigationItems = [
  {
    name: '[INSIGHTS]',
    href: '/x',
    icon: X,
    description: '观点见解'
  },
  {
    name: '[RSS]',
    href: '/rss',
    icon: Rss,
    description: 'X订阅管理'
  }
];

export function Navigation() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border backdrop-blur-sm bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-6 h-6 border border-foreground flex items-center justify-center">
                <span className="text-foreground font-mono text-xs font-bold">BN</span>
              </div>
              <span className="font-mono text-sm tracking-wider uppercase">BENOTIFY</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1 text-xs font-mono uppercase tracking-wider transition-all border ${
                    isActive
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-transparent hover:border-foreground'
                  }`}
                  title={item.description}
                >
                  {item.name}
                </Link>
              );
            })}
            <div className="ml-2 border-l border-border pl-2">
              <ThemeToggle />
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 border border-transparent hover:border-foreground transition-all"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? (
                <X className="block h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="block h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-border">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-3 py-2 text-xs font-mono uppercase tracking-wider transition-all border ${
                      isActive
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-transparent hover:border-foreground'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <div>{item.name}</div>
                    <div className="text-[10px] opacity-60 mt-1">{item.description}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
