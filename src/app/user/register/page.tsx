'use client';

import UserRegisterForm from '@/components/UserRegisterForm';
import { ToastContainer, useToast } from '@/components/Toast';

export default function RegisterPage() {
  const { toasts, removeToast } = useToast();
  
  return (
    <>
      <UserRegisterForm />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

