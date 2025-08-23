"use client";

import SidebarSessions from "@/components/SidebarSessions";
import CapturePanel from "@/components/CapturePanel";
import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="watchful logo" width={32} height={32} className="h-8 w-8 rounded" />
            <h1 className="text-2xl font-bold text-gray-900">watchful - Capture & AI Assist</h1>
          </div>
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
