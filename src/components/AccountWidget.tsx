"use client";

export default function AccountWidget() {
	return (
		<div className="fixed right-4 bottom-4 z-20">
			<div className="flex items-center gap-3 px-3 py-2 rounded-xl border bg-white/90 backdrop-blur border-gray-200 shadow-sm">
				<div className="h-6 w-6 rounded-full bg-gradient-to-br from-slate-200 to-slate-300" />
				<div className="text-sm">Signed out</div>
				<button className="ml-2 inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow hover:bg-gray-50">
					Sign in
				</button>
			</div>
		</div>
	);
}
