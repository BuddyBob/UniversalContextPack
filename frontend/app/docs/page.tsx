'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Search, Database, Sliders, Bot, Sparkles, HardDrive, ChevronRight, ArrowRight } from 'lucide-react';

export default function DocsIndexPage() {
    const [searchQuery, setSearchQuery] = useState('');

    // Cmd+K handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('docs-search')?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="min-h-screen bg-[#030303] text-[#EDEDED] flex overflow-hidden antialiased selection:bg-white selection:text-black">
            {/* Subtle noise texture */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")"
            }} />

            {/* Sidebar */}
            <aside className="hidden md:flex w-64 border-r border-[#1F1F1F] bg-[#030303] flex-col relative z-20">
                {/* Brand */}
                <div className="h-14 flex items-center px-6 border-b border-[#1F1F1F]">
                    <div className="w-4 h-4 bg-white rounded-sm mr-3" />
                    <span className="font-semibold text-sm tracking-tight text-white">Context Pack</span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8">
                    {/* Platform Section */}
                    <div>
                        <h4 className="px-3 text-[11px] uppercase tracking-widest text-[#888888] font-mono mb-2">PLATFORM</h4>
                        <ul className="space-y-0.5">
                            <li>
                                <Link href="/docs" className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-[#0A0A0A] border border-[#1F1F1F] rounded-md shadow-sm">
                                    <span className="text-white">Overview</span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/docs/move-chatgpt-memory" className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#888888] hover:text-white hover:bg-[#0A0A0A]/50 rounded-md transition-colors">
                                    <span>Quickstart</span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/how-to-port" className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#888888] hover:text-white hover:bg-[#0A0A0A]/50 rounded-md transition-colors">
                                    <span>Architecture</span>
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Guides Section */}
                    <div>
                        <h4 className="px-3 text-[11px] uppercase tracking-widest text-[#888888] font-mono mb-2">GUIDES</h4>
                        <ul className="space-y-0.5">
                            <li>
                                <Link href="/docs/move-chatgpt-memory" className="flex items-center justify-between px-3 py-1.5 text-sm text-[#888888] hover:text-white hover:bg-[#0A0A0A]/50 rounded-md transition-colors group">
                                    <span>Exporting Data</span>
                                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            </li>
                            <li>
                                <Link href="/docs/transfer-chatgpt-to-claude" className="flex items-center justify-between px-3 py-1.5 text-sm text-[#888888] hover:text-white hover:bg-[#0A0A0A]/50 rounded-md transition-colors group">
                                    <span>Migration Paths</span>
                                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            </li>
                            <li>
                                <Link href="/docs/manage-chatgpt-personal-memory" className="flex items-center justify-between px-3 py-1.5 text-sm text-[#888888] hover:text-white hover:bg-[#0A0A0A]/50 rounded-md transition-colors group">
                                    <span>Sanitization</span>
                                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Reference Section */}
                    <div>
                        <h4 className="px-3 text-[11px] uppercase tracking-widest text-[#888888] font-mono mb-2">REFERENCE</h4>
                        <ul className="space-y-0.5">
                            <li><Link href="/pricing" className="block px-3 py-1.5 text-sm text-[#888888] hover:text-white transition-colors">Pricing</Link></li>
                            <li><Link href="/security" className="block px-3 py-1.5 text-sm text-[#888888] hover:text-white transition-colors">Security</Link></li>
                        </ul>
                    </div>
                </nav>

                {/* System Status */}
                <div className="p-4 border-t border-[#1F1F1F]">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-[#888888] font-mono">System Operational</span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-[#030303]/80 backdrop-blur-sm border-b border-[#1F1F1F] h-14 flex items-center justify-between px-8">
                    <div className="flex items-center text-xs text-[#888888] font-mono">
                        <span>DOCS</span>
                        <span className="mx-2 text-[#1F1F1F]">/</span>
                        <span className="text-white">OVERVIEW</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-2.5 top-1.5 w-4 h-4 text-[#888888] group-hover:text-white transition-colors" />
                            <input
                                id="docs-search"
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-[#0A0A0A] border border-[#1F1F1F] rounded text-sm text-white pl-9 pr-3 py-1 w-64 focus:outline-none focus:border-[#888888] transition-colors placeholder:text-zinc-700"
                            />
                            <kbd className="absolute right-2 top-1.5 text-[10px] text-zinc-600 font-mono border border-zinc-800 rounded px-1">K</kbd>
                        </div>
                    </div>
                </header>

                <div className="max-w-5xl mx-auto px-8 py-16">
                    {/* Hero Title */}
                    <div className="mb-12">
                        <h1 className="text-3xl font-medium tracking-tight text-white mb-3">Documentation</h1>
                        <p className="text-[#888888] text-lg font-light leading-relaxed max-w-2xl">
                            The central hub for managing AI context. Export memory, structure datasets, and migrate seamlessly between LLM providers.
                        </p>
                    </div>

                    {/* Strict 12-Column Grid */}
                    <div className="grid grid-cols-12 gap-4">
                        {/* Primary Card: Export (Span 8) */}
                        <Link
                            href="/docs/move-chatgpt-memory"
                            className="col-span-12 md:col-span-8 group relative bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-6 hover:border-zinc-600 transition-colors duration-300"
                        >
                            <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1">
                                <ArrowRight className="w-5 h-5 text-white" />
                            </div>
                            <div className="w-10 h-10 bg-[#030303] border border-[#1F1F1F] rounded flex items-center justify-center mb-6 group-hover:text-white text-[#888888] transition-colors">
                                <Database className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-medium text-white mb-2">Move ChatGPT Memory</h2>
                            <p className="text-sm text-[#888888] leading-relaxed max-w-lg mb-4">
                                Extract your long-term context data. Learn about JSON structures, sanitization pipelines, and how to handle API limitations.
                            </p>
                            <div className="flex gap-2">
                                <span className="inline-flex items-center px-2 py-1 rounded border border-[#1F1F1F] bg-[#030303] text-[10px] font-mono text-[#888888] uppercase tracking-wider">GUIDE</span>
                                <span className="inline-flex items-center px-2 py-1 rounded border border-[#1F1F1F] bg-[#030303] text-[10px] font-mono text-[#888888] uppercase tracking-wider">5 MIN</span>
                            </div>
                        </Link>

                        {/* Secondary Card: Management (Span 4) */}
                        <Link
                            href="/docs/manage-chatgpt-personal-memory"
                            className="col-span-12 md:col-span-4 group relative bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-6 hover:border-zinc-600 transition-colors duration-300 flex flex-col justify-between"
                        >
                            <div>
                                <div className="w-10 h-10 bg-[#030303] border border-[#1F1F1F] rounded flex items-center justify-center mb-6 group-hover:text-white text-[#888888] transition-colors">
                                    <Sliders className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-medium text-white mb-2">Context Management</h2>
                                <p className="text-sm text-[#888888] leading-relaxed">
                                    Edit and delete specific memory nodes to ensure model accuracy.
                                </p>
                            </div>
                        </Link>

                        {/* Divider */}
                        <div className="col-span-12 py-4 flex items-center gap-4">
                            <span className="text-xs font-mono text-zinc-700 uppercase tracking-widest">MIGRATIONS</span>
                            <div className="h-[1px] bg-[#1F1F1F] flex-1" />
                        </div>

                        {/* Migration Cards (Span 4 each) */}
                        <Link
                            href="/docs/transfer-chatgpt-to-claude"
                            className="col-span-12 md:col-span-4 group bg-[#030303] border border-[#1F1F1F] rounded-lg p-5 hover:bg-[#0A0A0A] transition-all"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <Bot className="w-4 h-4 text-[#888888] group-hover:text-white transition-colors" />
                                <span className="text-sm font-medium text-white">Transfer to Claude</span>
                            </div>
                            <p className="text-xs text-[#888888] leading-5">
                                Format conversion for Anthropic's context window. Includes "Projects" setup.
                            </p>
                        </Link>

                        <Link
                            href="/docs/transfer-chatgpt-to-gemini"
                            className="col-span-12 md:col-span-4 group bg-[#030303] border border-[#1F1F1F] rounded-lg p-5 hover:bg-[#0A0A0A] transition-all"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <Sparkles className="w-4 h-4 text-[#888888] group-hover:text-white transition-colors" />
                                <span className="text-sm font-medium text-white">Transfer to Gemini</span>
                            </div>
                            <p className="text-xs text-[#888888] leading-5">
                                Optimize memory for Google's 1M+ token window.
                            </p>
                        </Link>

                        <Link
                            href="/packs"
                            className="col-span-12 md:col-span-4 group bg-[#030303] border border-[#1F1F1F] rounded-lg p-5 hover:bg-[#0A0A0A] transition-all"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <HardDrive className="w-4 h-4 text-[#888888] group-hover:text-white transition-colors" />
                                <span className="text-sm font-medium text-white">Local Backup</span>
                            </div>
                            <p className="text-xs text-[#888888] leading-5">
                                Save your context graph as a local JSON or Vector store.
                            </p>
                        </Link>

                        {/* Technical/Deep Dive Section (Span 12) */}
                        <div className="col-span-12 mt-4 bg-gradient-to-r from-[#0A0A0A] to-[#030303] border border-[#1F1F1F] rounded-lg p-1">
                            <div className="flex flex-col md:flex-row items-center justify-between p-5 gap-4">
                                <div>
                                    <h3 className="text-sm font-medium text-white mb-1">Understanding the Architecture</h3>
                                    <p className="text-xs text-[#888888]">Deep dive into Memory Pointers vs. History Logs.</p>
                                </div>
                                <div className="flex gap-3">
                                    <Link
                                        href="/docs/chatgpt-memory-vs-chat-history"
                                        className="px-4 py-2 bg-white text-black text-xs font-medium rounded hover:bg-gray-200 transition-colors"
                                    >
                                        Read Guide
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <footer className="mt-20 border-t border-[#1F1F1F] pt-8 flex justify-between items-center text-xs text-zinc-600">
                        <p>&copy; 2025 Context Pack Inc.</p>
                        <div className="flex gap-6">
                            <Link href="/privacy-policy" className="hover:text-zinc-400">Privacy</Link>
                            <Link href="/terms-of-service" className="hover:text-zinc-400">Terms</Link>
                        </div>
                    </footer>
                </div>
            </main>
        </div>

    );
}
