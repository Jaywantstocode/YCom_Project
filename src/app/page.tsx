"use client";

import SidebarSessions from "@/components/SidebarSessions";
import CapturePanel from "@/components/CapturePanel";
import AccountWidget from "@/components/AccountWidget";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6">
          <SidebarSessions />
          <div className="flex-1 rounded-xl border border-gray-200 bg-white/70 backdrop-blur shadow-sm">
            <CapturePanel />
          </div>
        </div>
      </div>
      <AccountWidget />
    </div>
  );
}
