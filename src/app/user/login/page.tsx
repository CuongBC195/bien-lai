'use client';

import UserLoginForm from '@/components/UserLoginForm';
import { ToastContainer, useToast } from '@/components/Toast';

export default function LoginPage() {
  const { toasts, removeToast } = useToast();
  
  return (
    <>
      <UserLoginForm />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

