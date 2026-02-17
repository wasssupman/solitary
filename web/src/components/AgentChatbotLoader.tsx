'use client';

import dynamic from 'next/dynamic';

const AgentChatbot = dynamic(() => import('./AgentChatbot'), { ssr: false });

export default function AgentChatbotLoader() {
  return <AgentChatbot />;
}
