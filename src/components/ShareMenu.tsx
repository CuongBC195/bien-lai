'use client';

import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Mail } from 'lucide-react';

interface ShareMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyLink: () => void;
  onSendEmail: () => void;
  position?: { x: number; y: number };
}

export default function ShareMenu({ isOpen, onClose, onCopyLink, onSendEmail, position }: ShareMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is inside menu
      if (menuRef.current && menuRef.current.contains(event.target as Node)) {
        return; // Don't close if clicking inside menu
      }
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Delay adding listener to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleCopyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Copy clicked'); // Debug
    onCopyLink();
    onClose();
  };

  const handleEmailClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Email clicked'); // Debug
    onSendEmail();
    onClose();
  };

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-gray-800 rounded-xl shadow-2xl border border-white/10 py-2 min-w-[180px]"
      style={{
        top: position?.y || 0,
        left: Math.max(10, (position?.x || 0) - 180),
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleCopyClick}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-200 hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Copy className="w-4 h-4" />
        <span className="font-medium">Copy link</span>
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleEmailClick}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-200 hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Mail className="w-4 h-4" />
        <span className="font-medium">Gửi email</span>
      </button>
    </div>
  );

  // Use portal to render menu at document body level
  return createPortal(menuContent, document.body);
}
