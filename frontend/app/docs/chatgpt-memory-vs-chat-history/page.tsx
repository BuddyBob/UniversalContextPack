import type { Metadata } from 'next';
import Link from 'next/link';
import DocsLayout from '@/components/DocsLayout';

export const metadata: Metadata = {
    title: 'ChatGPT Memory vs Chat History: What\'s the Difference? | Context Pack',
    description: 'Understand the difference between ChatGPT memory, chat history, and conversation exports. Learn what each stores and how to access your data.',
    openGraph: {
        title: 'ChatGPT Memory vs Chat History: What\'s the Difference?',
        description: 'Understand the difference between ChatGPT memory, chat history, and conversation exports. Learn what each stores and how to access your data.',
        url: 'https://www.context-pack.com/docs/chatgpt-memory-vs-chat-history',
        type: 'article',
    },
};

export default function MemoryVsHistoryPage() {
    return (
        <DocsLayout>
            <article className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4">
                        ChatGPT Memory vs Chat History vs Exports
                    </h1>
                    <div className="flex items-center gap-4 text-sm text-muted">
                        <span>Last Updated: December 16, 2025</span>
                    </div>
                </div>

                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Quick Answer</h2>

                    <p className="text-secondary leading-relaxed mb-6">
                        ChatGPT has three distinct data types: <strong>Memory</strong> stores specific facts about you across all conversations, <strong>Chat History</strong> records complete conversations, and <strong>Exports</strong> provide downloadable copies of your chat history in JSON format.
                    </p>

                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-card border border-card rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-3">Memory</h3>
                            <p className="text-secondary text-sm">Persistent facts ChatGPT learned about you</p>
                        </div>
                        <div className="bg-card border border-card rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-3">Chat History</h3>
                            <p className="text-secondary text-sm">Full transcripts of individual conversations</p>
                        </div>
                        <div className="bg-card border border-card rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-3">Exports</h3>
                            <p className="text-secondary text-sm">Downloadable JSON files of conversations</p>
                        </div>
                    </div>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Detailed Comparison</h2>

                    <div className="space-y-6">
                        <div className="bg-card border border-card rounded-xl p-6">
                            <h3 className="text-2xl font-semibold mb-4">ChatGPT Memory</h3>

                            <div className="mb-4">
                                <h4 className="text-lg font-semibold mb-2">What it stores:</h4>
                                <p className="text-secondary">Specific facts, preferences, and context about you that ChatGPT learns over time across all conversations.</p>
                            </div>

                            <div className="mb-4">
                                <h4 className="text-lg font-semibold mb-2">How it works:</h4>
                                <p className="text-secondary">Automatically updates as you chat. ChatGPT identifies important information and stores it for future reference.</p>
                            </div>

                            <div className="mb-4">
                                <h4 className="text-lg font-semibold mb-2">Access:</h4>
                                <p className="text-secondary">Settings → Personalization → Manage Memory</p>
                            </div>

                            <div>
                                <h4 className="text-lg font-semibold mb-2">Export:</h4>
                                <p className="text-secondary">No direct export. Must be manually copied.</p>
                            </div>
                        </div>

                        <div className="bg-card border border-card rounded-xl p-6">
                            <h3 className="text-2xl font-semibold mb-4">Chat History</h3>

                            <div className="mb-4">
                                <h4 className="text-lg font-semibold mb-2">What it stores:</h4>
                                <p className="text-secondary">Complete transcripts of every conversation, including all messages sent and received.</p>
                            </div>

                            <div className="mb-4">
                                <h4 className="text-lg font-semibold mb-2">How it works:</h4>
                                <p className="text-secondary">Each conversation is saved separately. Accessible from the sidebar. Can be searched, renamed, or deleted.</p>
                            </div>

                            <div className="mb-4">
                                <h4 className="text-lg font-semibold mb-2">Access:</h4>
                                <p className="text-secondary">ChatGPT sidebar (left panel)</p>
                            </div>

                            <div>
                                <h4 className="text-lg font-semibold mb-2">Export:</h4>
                                <p className="text-secondary">Included in OpenAI data export (Settings → Data controls → Export data)</p>
                            </div>
                        </div>

                        <div className="bg-card border border-card rounded-xl p-6">
                            <h3 className="text-2xl font-semibold mb-4">Conversation Exports</h3>

                            <div className="mb-4">
                                <h4 className="text-lg font-semibold mb-2">What it provides:</h4>
                                <p className="text-secondary">Downloadable JSON files containing all your chat history and associated metadata.</p>
                            </div>

                            <div className="mb-4">
                                <h4 className="text-lg font-semibold mb-2">How it works:</h4>
                                <p className="text-secondary">Request from OpenAI, receive email with download link in 24-48 hours. ZIP file contains JSON data.</p>
                            </div>

                            <div className="mb-4">
                                <h4 className="text-lg font-semibold mb-2">Access:</h4>
                                <p className="text-secondary">Settings → Data controls → Export data</p>
                            </div>

                            <div>
                                <h4 className="text-lg font-semibold mb-2">Export:</h4>
                                <p className="text-secondary">Already an export. Requires JSON processing to read.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Related Guides</h2>
                    <div className="space-y-4">
                        <div>
                            <Link href="/docs/move-chatgpt-memory" className="text-lg font-medium text-accent-primary hover:underline">
                                How to Move ChatGPT Memory
                            </Link>
                            <p className="text-secondary text-sm">Export and back up your memories</p>
                        </div>
                        <div>
                            <Link href="/docs/export-chatgpt-conversations" className="text-lg font-medium text-accent-primary hover:underline">
                                How to Move ChatGPT Conversations
                            </Link>
                            <p className="text-secondary text-sm">Download your full chat history</p>
                        </div>
                        <div>
                            <Link href="/docs/manage-chatgpt-personal-memory" className="text-lg font-medium text-accent-primary hover:underline">
                                How to Manage ChatGPT Personal Memory
                            </Link>
                            <p className="text-secondary text-sm">View and edit stored memories</p>
                        </div>
                    </div>
                </section>
            </article>
        </DocsLayout>
    );
}
