"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AgentLogItem = {
	id: string;
	ts: number;
	level: 'info' | 'warn' | 'error';
	message: string;
};

export type AgentTip = {
	id: string;
	ts: number;
	title: string;
	detail?: string;
};

export type SessionRecord = {
	id: string;
	startedAt: number;
	stoppedAt?: number;
	log: AgentLogItem[];
	tips: AgentTip[];
};

export type SessionContextValue = {
	sessions: SessionRecord[];
	activeSessionId: string | null;
	activeSession: SessionRecord | null;
	startSession: () => string;
	stopSession: () => void;
	appendLog: (entry: Omit<AgentLogItem, 'id' | 'ts'> & { id?: string; ts?: number }) => void;
	appendTip: (tip: Omit<AgentTip, 'id' | 'ts'> & { id?: string; ts?: number }) => void;
	clearAll: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = 'ycom.sessions.v1';

function generateId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadFromStorage(): SessionRecord[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as SessionRecord[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveToStorage(sessions: SessionRecord[]) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
	} catch {
		// ignore
	}
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
	const [sessions, setSessions] = useState<SessionRecord[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

	useEffect(() => {
		setSessions(loadFromStorage());
	}, []);

	useEffect(() => {
		saveToStorage(sessions);
	}, [sessions]);

	const activeSession = useMemo(
		() => sessions.find((s) => s.id === activeSessionId) ?? null,
		[sessions, activeSessionId]
	);

	const startSession = useCallback(() => {
		const id = generateId('session');
		const newSession: SessionRecord = { id, startedAt: Date.now(), log: [], tips: [] };
		setSessions((prev) => [newSession, ...prev]);
		setActiveSessionId(id);
		return id;
	}, []);

	const stopSession = useCallback(() => {
		setSessions((prev) =>
			prev.map((s) => (s.id === activeSessionId && !s.stoppedAt ? { ...s, stoppedAt: Date.now() } : s))
		);
		setActiveSessionId(null);
	}, [activeSessionId]);

	const appendLog = useCallback<SessionContextValue['appendLog']>(
		(entry) => {
			const id = entry.id ?? generateId('log');
			const ts = entry.ts ?? Date.now();
			setSessions((prev) =>
				prev.map((s) =>
					s.id === activeSessionId
						? { ...s, log: [...s.log, { id, ts, level: entry.level, message: entry.message }] }
						: s
				)
			);
		},
		[activeSessionId]
	);

	const appendTip = useCallback<SessionContextValue['appendTip']>(
		(tip) => {
			const id = tip.id ?? generateId('tip');
			const ts = tip.ts ?? Date.now();
			setSessions((prev) =>
				prev.map((s) => (s.id === activeSessionId ? { ...s, tips: [...s.tips, { id, ts, title: tip.title, detail: tip.detail }] } : s))
			);
		},
		[activeSessionId]
	);

	const clearAll = useCallback(() => {
		setSessions([]);
		setActiveSessionId(null);
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {}
	}, []);

	const value = useMemo<SessionContextValue>(
		() => ({ sessions, activeSessionId, activeSession, startSession, stopSession, appendLog, appendTip, clearAll }),
		[sessions, activeSessionId, activeSession, startSession, stopSession, appendLog, appendTip, clearAll]
	);

	return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext() {
	const ctx = useContext(SessionContext);
	if (!ctx) throw new Error('useSessionContext must be used within SessionProvider');
	return ctx;
}
