'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type RealtimeSocket = WebSocket & { _connectedAt?: number };

export function useRealtimeSpeaker() {
	const socketRef = useRef<RealtimeSocket | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const [isReady, setIsReady] = useState(false);
	const isConnectingRef = useRef(false);
	const lastPlayAtRef = useRef<number>(0);

	const ensureAudioContext = useCallback(() => {
		if (!audioContextRef.current) {
			audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
		}
		return audioContextRef.current;
	}, []);

	const disconnect = useCallback(() => {
		setIsReady(false);
		if (socketRef.current) {
			try { if (socketRef.current.readyState === WebSocket.OPEN) socketRef.current.close(); } catch {}
			socketRef.current = null;
		}
	}, []);

	const connect = useCallback(async () => {
		if (isConnectingRef.current || socketRef.current) return;
		isConnectingRef.current = true;
		try {
			const res = await fetch('/api/realtime/session', { method: 'POST' });
			if (!res.ok) throw new Error('Failed to create realtime session');
			const { clientSecret } = (await res.json()) as { sessionId: string; clientSecret: string | null };
			if (!clientSecret) throw new Error('Missing client secret');

			const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
			const socket = new WebSocket(url, ['realtime', `openai-insecure-api-key.${clientSecret}`, 'openai-beta.realtime-v1']) as RealtimeSocket;
			socket._connectedAt = Date.now();
			socketRef.current = socket;

			socket.onopen = () => {
				setIsReady(true);
				isConnectingRef.current = false;
			};

			socket.onmessage = async (event) => {
				// Handle audio delta frames (PCM16 16kHz mono)
				try {
					const data = JSON.parse(event.data as string) as { type?: string; delta?: string };
					if (data.type === 'response.audio.delta' && data.delta) {
						const base64 = data.delta as unknown as string;
						const byteString = atob(base64);
						const len = byteString.length;
						const bytes = new Uint8Array(len);
						for (let i = 0; i < len; i++) bytes[i] = byteString.charCodeAt(i);

						// Convert little-endian PCM16 bytes to Float32 samples
						const sampleRate = 16000;
						const numSamples = Math.floor(bytes.length / 2);
						const ctx = ensureAudioContext();
						const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
						const channel = audioBuffer.getChannelData(0);
						for (let i = 0, j = 0; i < numSamples; i++, j += 2) {
							const lo = bytes[j];
							const hi = bytes[j + 1];
							let sample = (hi << 8) | lo; // little-endian
							if (sample >= 0x8000) sample = sample - 0x10000; // two's complement
							channel[i] = Math.max(-1, Math.min(1, sample / 32768));
						}
						const source = ctx.createBufferSource();
						source.buffer = audioBuffer;
						source.connect(ctx.destination);
						source.start();
						lastPlayAtRef.current = Date.now();
					}
				} catch {
					// Some frames may be non-JSON; ignore silently
				}
			};

			socket.onclose = () => {
				setIsReady(false);
				socketRef.current = null;
			};
		} catch {
			isConnectingRef.current = false;
		}
	}, [ensureAudioContext]);

	useEffect(() => {
		return () => {
			if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
				socketRef.current.close();
			}
			socketRef.current = null;
		};
	}, []);

	const speak = useCallback(async (text: string) => {
		if (!text) return;
		if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
			await connect();
			// give a tick for onopen
			await new Promise((r) => setTimeout(r, 50));
		}
		if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

		// Short, witty English one-liner
		const instructions = `Give a very short, witty English one-liner about the current screen. No preamble. Focus: ${text}`;
		socketRef.current.send(
			JSON.stringify({
				type: 'session.update',
				session: { instructions },
			}),
		);
		socketRef.current.send(JSON.stringify({ type: 'response.create' }));
	}, [connect]);

	return { isReady, connect, disconnect, speak };
}


