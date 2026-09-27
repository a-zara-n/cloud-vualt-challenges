'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ChatWindow from '@/components/ChatWindow';

export default function ChatPage() {
  return (
    <>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">AI Security Assistant</h1>
        <p className="text-gray-600 mb-8">
          Ask questions about cloud security, AWS best practices, or get hints for challenges.
        </p>
        <ChatWindow />
      </main>
      <Footer />
    </>
  );
}
