'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  imageDescription: string;
};

export default function RealtimeAgent({ imageDescription }: Props) {
  const [responseText, setResponseText] = useState('');
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let isActive = true;

    async function init() {
      if (!imageDescription) return;

      const res = await fetch('/api/realtime/session', { method: 'POST' });
      if (!res.ok) return;
      const { clientSecret } = (await res.json()) as { sessionId: string; clientSecret: string | null };
      if (!clientSecret) return;

      const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
      const socket = new WebSocket(url, ['realtime', `openai-insecure-api-key.${clientSecret}`, 'openai-beta.realtime-v1']);
      socketRef.current = socket;

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              instructions: `画像の内容をリアルタイムで実況してください。必要に応じて要点を箇条書きでも。\n${imageDescription}`,
            },
          }),
        );
        socket.send(JSON.stringify({ type: 'response.create' }));
      };

      socket.onmessage = async (event) => {
        if (!isActive) return;
        try {
          const data = JSON.parse(event.data as string) as { type?: string; delta?: string; };
          if (data.type === 'response.text.delta' && data.delta) {
            setResponseText((prev) => prev + data.delta);
          }
          if (data.type === 'response.audio.delta' && data.delta) {
            const b64 = data.delta as unknown as string;
            const byteString = atob(b64);
            const len = byteString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = byteString.charCodeAt(i);

            if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer.slice(0));
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start();
          }
        } catch {
          // ignore non-JSON frames from server if any
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
      };
    }

    init();

    return () => {
      isActive = false;
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      socketRef.current = null;
    };
  }, [imageDescription]);

  return (
    <div className="text-sm whitespace-pre-wrap leading-relaxed">
      {responseText || '接続中...'}
    </div>
  );
}


