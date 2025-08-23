"use client";

import { useCallback, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

type UploadResult = { url: string; path: string } | null;

type DisplayMediaStreamConstraints = {
	video?: boolean | MediaTrackConstraints;
	audio?: boolean | MediaTrackConstraints;
};

type ImageCaptureLike = { grabFrame(): Promise<ImageBitmap> };
// Constructor type for browsers that support ImageCapture
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike;

function getImageCaptureCtor(): ImageCaptureCtor | undefined {
	const g = globalThis as unknown as { ImageCapture?: ImageCaptureCtor };
	return g.ImageCapture;
}

declare global {
	interface MediaDevices {
		getDisplayMedia(constraints?: DisplayMediaStreamConstraints): Promise<MediaStream>;
	}
}

export default function CaptureClient() {
	const { permission, request: requestNotif, notify, isSupported } = useNotifications();
	const [isRecording, setIsRecording] = useState(false);
	const [status, setStatus] = useState<string>('');
	const [uploaded, setUploaded] = useState<UploadResult>(null);
	const [saveLocal, setSaveLocal] = useState<boolean>(true);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const recordedChunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);
	const shotTimerRef = useRef<number | null>(null);
	const recTimerRef = useRef<number | null>(null);
	const recInFlightRef = useRef<boolean>(false);

	const resetUpload = useCallback(() => {
		setUploaded(null);
		setStatus('');
	}, []);

	const saveFile = useCallback((file: File) => {
		try {
			const url = URL.createObjectURL(file);
			const a = document.createElement('a');
			a.href = url;
			a.download = file.name;
			a.rel = 'noopener';
			a.style.display = 'none';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch {}
	}, []);

	const uploadTo = useCallback(async (endpoint: '/api/capture/screenshot' | '/api/capture/recording', file: File) => {
		const formData = new FormData();
		formData.append('file', file);
		const res = await fetch(endpoint, { method: 'POST', body: formData });
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error((data as { error?: string }).error || 'Upload failed');
		}
		return (await res.json()) as { url: string; path: string };
	}, []);

	// Capture a still frame from the screen share stream if available; fallback to html2canvas
	const captureStillBlob = useCallback(async (): Promise<Blob | null> => {
		const stream = streamRef.current;
		try {
			const ImageCapture = getImageCaptureCtor();
			if (stream && ImageCapture) {
				const track = stream.getVideoTracks()[0];
				if (!track) return null;
				const ic = new ImageCapture(track);
				const bitmap = await ic.grabFrame();
				const canvas = document.createElement('canvas');
				canvas.width = bitmap.width;
				canvas.height = bitmap.height;
				canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
				return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
			}
		} catch {}
		// fallback
		try {
			const canvas = await html2canvas(document.body);
			return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
		} catch {
			return null;
		}
	}, []);

	const handleScreenshot = useCallback(async () => {
		try {
			resetUpload();
			setStatus('Capturing screenshot...');
			const blob = await captureStillBlob();
			if (!blob) throw new Error('Failed to create image');
			const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
			if (saveLocal) saveFile(file);
			const data = await uploadTo('/api/capture/screenshot', file);
			setUploaded(data);
			setStatus('Uploaded');
		} catch (e) {
			setStatus(e instanceof Error ? e.message : 'Error');
		}
	}, [resetUpload, uploadTo, saveLocal, saveFile, captureStillBlob]);

	const startRecordingCycle = useCallback(() => {
		const runOnce = () => {
			if (recInFlightRef.current) return; // avoid overlap
			recInFlightRef.current = true;
			const baseStream = streamRef.current;
			if (!baseStream) {
				recInFlightRef.current = false;
				return;
			}
			try {
				const chunks: Blob[] = [];
				const r = new MediaRecorder(baseStream, { mimeType: 'video/webm;codecs=vp9,opus' });
				r.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
				r.onstop = async () => {
					try {
						const blob = new Blob(chunks, { type: 'video/webm' });
						const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'video/webm' });
						if (saveLocal) saveFile(file);
						const data = await uploadTo('/api/capture/recording', file);
						setUploaded(data);
						setStatus('Uploaded recording');
					} catch (err) {
						setStatus(err instanceof Error ? err.message : 'Upload error');
					} finally {
						recInFlightRef.current = false;
						// schedule next cycle in 60s
						recTimerRef.current = window.setTimeout(runOnce, 60000);
					}
				};
				r.start();
				// record for 60s
				setTimeout(() => r.stop(), 60000);
			} catch {
				recInFlightRef.current = false;
			}
		};
		// kick off first cycle now
		runOnce();
	}, [saveLocal, saveFile, uploadTo]);

	const startPeriodicScreenshots = useCallback(() => {
		shotTimerRef.current = window.setInterval(async () => {
			try {
				const blob = await captureStillBlob();
				if (!blob) return;
				const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
				if (saveLocal) saveFile(file);
				await uploadTo('/api/capture/screenshot', file);
				setStatus('Uploaded screenshot');
			} catch {}
		}, 5000);
	}, [saveLocal, saveFile, uploadTo, captureStillBlob]);

	const handleStartRecording = useCallback(async () => {
		try {
			resetUpload();
			setStatus('Requesting screen share...');
			if (isSupported && permission !== 'granted') {
				await requestNotif();
			}
			const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
			streamRef.current = stream;
			// base recorder for session-long capture (optional)
			const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
			recordedChunksRef.current = [];
			mr.ondataavailable = (event) => { if (event.data.size > 0) recordedChunksRef.current.push(event.data); };
			mr.onstop = async () => {
				try {
					const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
					const file = new File([blob], `session-recording-${Date.now()}.webm`, { type: 'video/webm' });
					if (saveLocal) saveFile(file);
					await uploadTo('/api/capture/recording', file);
				} catch {}
			};
			mr.start();
			mediaRecorderRef.current = mr;
			setIsRecording(true);
			setStatus('Recording (periodic: screenshot 5s, recording 60s)...');
			startPeriodicScreenshots();
			startRecordingCycle();
			if (permission === 'granted') {
				notify('Recording started', { body: 'Periodic screenshot (5s) and 60s video every minute.' });
			}
		} catch (e) {
			setStatus(e instanceof Error ? e.message : 'Error');
		}
	}, [resetUpload, uploadTo, saveLocal, saveFile, startPeriodicScreenshots, startRecordingCycle, isSupported, permission, requestNotif, notify]);

	const handleStopRecording = useCallback(() => {
		if (shotTimerRef.current) window.clearInterval(shotTimerRef.current);
		if (recTimerRef.current) window.clearTimeout(recTimerRef.current);
		shotTimerRef.current = null;
		recTimerRef.current = null;
		recInFlightRef.current = false;
		const mr = mediaRecorderRef.current;
		if (mr && mr.state !== 'inactive') {
			mr.stop();
		}
		const s = streamRef.current;
		if (s) {
			s.getTracks().forEach((t) => t.stop());
			streamRef.current = null;
		}
		setIsRecording(false);
		setStatus('Stopped');
	}, []);

	return (
		<Card className="w-full max-w-2xl">
			<CardHeader>
				<CardTitle>Capture</CardTitle>
				<CardDescription>Auto capture screenshots and recordings; save locally and upload.</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<div className="inline-flex items-center gap-2">
						<Switch id="saveLocal" checked={saveLocal} onCheckedChange={(v) => setSaveLocal(Boolean(v))} />
						<label htmlFor="saveLocal" className="select-none text-sm text-gray-700">Save locally</label>
					</div>
				</div>
				<div className="flex gap-3">
					{!isRecording ? (
						<Button onClick={handleStartRecording} variant="default">Start Recording (auto)</Button>
					) : (
						<Button onClick={handleStopRecording} variant="destructive">Stop Recording</Button>
					)}
					<Button onClick={handleScreenshot} variant="secondary">Take Screenshot Now</Button>
				</div>
				<div className="text-sm text-gray-600 min-h-5">{status}</div>
			</CardContent>
			{uploaded?.url ? (
				<CardFooter>
					<a className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-200 bg-white/70 px-3 py-2 text-sm text-blue-700 underline shadow hover:no-underline" href={uploaded.url} target="_blank" rel="noreferrer">
						Open last upload
					</a>
				</CardFooter>
			) : null}
		</Card>
	);
}
