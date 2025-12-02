'use client';

import React, { useRef, useEffect } from 'react';
import { Copy, Mail, X } from 'lucide-react';

interface ShareMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyLink: () => void;
  onSendEmail: () => void;
  position?: { x: number; y: number };
}

export default function ShareMenu({ isOpen, onClose, onCopyLink, onSendEmail, position }: ShareMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 bg-gray-800 rounded-xl shadow-xl border border-white/10 py-2 min-w-[180px]"
        style={{
          top: position?.y || 0,
          left: Math.max(10, (position?.x || 0) - 180),
        }}
      >
        <button
          onClick={() => {
            onCopyLink();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-200 hover:bg-white/10 transition-colors"
        >
          <Copy className="w-4 h-4" />
          <span className="font-medium">Copy link</span>
        </button>
        <button
          onClick={() => {
            onSendEmail();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-200 hover:bg-white/10 transition-colors"
        >
          <Mail className="w-4 h-4" />
          <span className="font-medium">Gửi email</span>
        </button>
      </div>
    </>
  );
}
