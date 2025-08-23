"use client";

import { useCallback, useRef, useState } from 'react';
import html2canvas from 'html2canvas';

type UploadResult = { url: string; path: string } | null;

type DisplayMediaStreamConstraints = {
	video?: boolean | MediaTrackConstraints;
	audio?: boolean | MediaTrackConstraints;
};

declare global {
	interface MediaDevices {
		getDisplayMedia(constraints?: DisplayMediaStreamConstraints): Promise<MediaStream>;
	}
}

export default function CaptureClient() {
	const [isRecording, setIsRecording] = useState(false);
	const [status, setStatus] = useState<string>('');
	const [uploaded, setUploaded] = useState<UploadResult>(null);
	const [saveLocal, setSaveLocal] = useState<boolean>(true);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const recordedChunksRef = useRef<Blob[]>([]);

	const resetUpload = useCallback(() => {
		setUploaded(null);
		setStatus('');
	}, []);

	const saveFile = useCallback((file: File) => {
		const url = URL.createObjectURL(file);
		const a = document.createElement('a');
		a.href = url;
		a.download = file.name;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, []);

	const uploadFile = useCallback(async (file: File) => {
		setStatus('Uploading...');
		const formData = new FormData();
		formData.append('file', file);
		const res = await fetch('/api/upload', { method: 'POST', body: formData });
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error((data as { error?: string }).error || 'Upload failed');
		}
		const data = (await res.json()) as { url: string; path: string };
		setUploaded(data);
		setStatus('Uploaded');
	}, []);

	const handleScreenshot = useCallback(async () => {
		try {
			resetUpload();
			setStatus('Capturing screenshot...');
			const canvas = await html2canvas(document.body);
			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
			if (!blob) throw new Error('Failed to create image');
			const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
			if (saveLocal) {
				saveFile(file);
			}
			await uploadFile(file);
		} catch (e) {
			setStatus(e instanceof Error ? e.message : 'Error');
		}
	}, [resetUpload, uploadFile, saveLocal, saveFile]);

	const handleStartRecording = useCallback(async () => {
		try {
			resetUpload();
			setStatus('Requesting screen share...');
			const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
			const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
			recordedChunksRef.current = [];
			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					recordedChunksRef.current.push(event.data);
				}
			};
			mediaRecorder.onstop = async () => {
				try {
					setStatus('Preparing video...');
					const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
					const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'video/webm' });
					if (saveLocal) {
						saveFile(file);
					}
					await uploadFile(file);
				} catch (e) {
					setStatus(e instanceof Error ? e.message : 'Error');
				}
			};
			mediaRecorder.start();
			mediaRecorderRef.current = mediaRecorder;
			setIsRecording(true);
			setStatus('Recording...');
		} catch (e) {
			setStatus(e instanceof Error ? e.message : 'Error');
		}
	}, [resetUpload, uploadFile, saveLocal, saveFile]);

	const handleStopRecording = useCallback(() => {
		const mediaRecorder = mediaRecorderRef.current;
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
			mediaRecorder.stream.getTracks().forEach((t) => t.stop());
			setIsRecording(false);
		}
	}, []);

	return (
		<div className="w-full max-w-2xl flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 backdrop-blur px-3 py-1 text-sm shadow-sm">
					<input id="saveLocal" type="checkbox" className="accent-blue-600" checked={saveLocal} onChange={(e) => setSaveLocal(e.target.checked)} />
					<label htmlFor="saveLocal" className="select-none">Save locally</label>
				</div>
			</div>
			<div className="flex gap-3">
				<button
					onClick={handleScreenshot}
					className="px-4 py-2 rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
				>
					Take Screenshot
				</button>
				{!isRecording ? (
					<button
						onClick={handleStartRecording}
						className="px-4 py-2 rounded-lg bg-emerald-600 text-white shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
					>
						Start Recording
					</button>
				) : (
					<button
						onClick={handleStopRecording}
						className="px-4 py-2 rounded-lg bg-red-600 text-white shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
					>
						Stop Recording
					</button>
				)}
			</div>
			<div className="text-sm text-gray-600 min-h-5">{status}</div>
			{uploaded?.url ? (
				<a className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-200 bg-white/70 px-3 py-2 text-sm text-blue-700 underline shadow hover:no-underline" href={uploaded.url} target="_blank" rel="noreferrer">
					Open uploaded file
				</a>
			) : null}
		</div>
	);
}
