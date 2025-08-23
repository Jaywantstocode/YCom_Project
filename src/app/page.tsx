"use client";

import SidebarSessions from "@/components/SidebarSessions";
import CapturePanel from "@/components/CapturePanel";
import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">YCom - Capture & AI Assist</h1>
          <Link href="/knowledge">
            <Button variant="outline" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Knowledge Base
            </Button>
          </Link>
        </div>

        <div className="flex gap-6">
          <SidebarSessions />
          <div className="flex-1 rounded-xl border border-gray-200 bg-white/70 backdrop-blur shadow-sm">
            <CapturePanel />
          </div>
        </div>
      </div>
    </div>
  );
}
