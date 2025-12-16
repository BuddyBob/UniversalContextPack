import type { Metadata } from 'next';
import Link from 'next/link';
import DocsLayout from '@/components/DocsLayout';

export const metadata: Metadata = {
    title: 'How to Transfer ChatGPT to Gemini | Context Pack',
    description: 'Learn how to transfer ChatGPT context and conversations to Google Gemini. Step-by-step guide for migrating AI memory between platforms.',
    openGraph: {
        title: 'How to Transfer ChatGPT to Gemini',
        description: 'Step-by-step guide for migrating ChatGPT context to Google Gemini',
        url: 'https://www.context-pack.com/docs/transfer-chatgpt-to-gemini',
        type: 'article',
    },
};

export default function TransferChatGPTToGeminiPage() {
    return (
        <DocsLayout>
            <article className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4">
                        How to Transfer ChatGPT Context to Gemini
                    </h1>
                    <div className="flex items-center gap-4 text-sm text-muted">
                        <span>Last Updated: December 16, 2025</span>
                    </div>
                </div>

                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Quick Answer</h2>

                    <p className="text-secondary leading-relaxed mb-6">
                        To transfer ChatGPT context to Gemini, export your ChatGPT conversation history, then paste relevant content into your Gemini conversations or use Context Pack to create Gemini-compatible context files.
                    </p>

                    <div className="mb-6">
                        <h3 className="text-xl font-semibold mb-4">How to transfer ChatGPT context to Gemini:</h3>
                        <ol className="list-decimal list-inside space-y-3 text-secondary">
                            <li>Export your ChatGPT conversations (Settings → Data controls → Export data)</li>
                            <li>Wait for the download link from OpenAI (24-48 hours)</li>
                            <li>Extract and review your conversation files</li>
                            <li>Copy relevant conversation content</li>
                            <li>Paste into Gemini at the start of a new conversation</li>
                            <li>Alternatively, use Context Pack to generate formatted context for Gemini</li>
                        </ol>
                    </div>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Transfer Methods</h2>

                    <div className="bg-card border border-card rounded-xl p-6 mb-6 shadow-md">
                        <h3 className="text-2xl font-semibold mb-3">Manual Context Pasting</h3>

                        <p className="text-secondary leading-relaxed mb-4">
                            Gemini allows you to include context by pasting it at the beginning of your conversation. Export your ChatGPT data and paste the most relevant conversations into Gemini.
                        </p>

                        <h4 className="text-lg font-semibold mb-2">Best for:</h4>
                        <p className="text-secondary leading-relaxed">
                            Users with specific conversations they want to reference in Gemini.
                        </p>
                    </div>

                    <div className="bg-card border border-card rounded-xl p-6 mb-6 shadow-md">
                        <h3 className="text-2xl font-semibold mb-3">Using Context Pack</h3>

                        <p className="text-secondary leading-relaxed mb-4">
                            Context Pack creates formatted, platform-agnostic context files that work across all AI models, including Gemini. Get structured behavioral profiles instead of raw conversation dumps.
                        </p>

                        <Link
                            href="/how-to-port"
                            className="inline-block mt-4 text-accent-primary hover:underline font-medium"
                        >
                            Learn about Context Pack →
                        </Link>
                    </div>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Related Guides</h2>
                    <div className="space-y-4">
                        <div>
                            <Link href="/docs/Move-chatgpt-memory" className="text-lg font-medium text-accent-primary hover:underline">
                                How to Move ChatGPT Memory
                            </Link>
                            <p className="text-secondary text-sm">Get your data from ChatGPT first</p>
                        </div>
                        <div>
                            <Link href="/docs/transfer-chatgpt-to-claude" className="text-lg font-medium text-accent-primary hover:underline">
                                How to Transfer ChatGPT Context to Claude
                            </Link>
                            <p className="text-secondary text-sm">Transfer to Claude instead</p>
                        </div>
                        <div>
                            <Link href="/docs/move-ai-memory-across-platforms" className="text-lg font-medium text-accent-primary hover:underline">
                                How to Move AI Memory Across Platforms
                            </Link>
                            <p className="text-secondary text-sm">Cross-platform transfer strategies</p>
                        </div>
                    </div>
                </section>
            </article>
        </DocsLayout>
    );
}
