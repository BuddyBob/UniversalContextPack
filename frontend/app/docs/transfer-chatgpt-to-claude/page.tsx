import type { Metadata } from 'next';
import Link from 'next/link';
import DocsLayout from '@/components/DocsLayout';

export const metadata: Metadata = {
    title: 'How to Transfer ChatGPT Context to Claude | Context Pack',
    description: 'Move your ChatGPT conversations and context to Claude AI. Export ChatGPT data, format for Claude, and maintain continuity when switching AI assistants.',
    openGraph: {
        title: 'How to Transfer ChatGPT Context to Claude',
        description: 'Move your ChatGPT conversations and context to Claude AI. Export ChatGPT data, format for Claude, and maintain continuity when switching AI assistants.',
        url: 'https://www.context-pack.com/docs/transfer-chatgpt-to-claude',
        type: 'article',
    },
};

export default function TransferChatGPTToClaudePage() {
    const schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Article",
                "headline": "How to Transfer ChatGPT Context to Claude",
                "description": "Move your ChatGPT conversations and context to Claude AI. Export ChatGPT data, format for Claude, and maintain continuity when switching AI assistants.",
                "datePublished": "2025-12-16",
                "dateModified": "2025-12-16",
                "author": {
                    "@type": "Organization",
                    "name": "Context Pack"
                }
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": "Can I move ChatGPT to Claude?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "You cannot move ChatGPT's memory feature to Claude, but you can export conversation history and load it into Claude's Projects feature or use Context Pack for formatted context transfer."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "How do I import ChatGPT conversations into Claude?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Export ChatGPT conversations via OpenAI data export, then paste the content directly into a Claude Project or use Context Pack to generate Claude-compatible context files."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Does Claude support ChatGPT memory import?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Claude does not directly import ChatGPT memory, but its Projects feature allows you to paste exported conversation content to maintain context continuity."
                        }
                    }
                ]
            }
        ]
    };

    return (
        <DocsLayout>
            <>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
                />

                <article className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
                    <div className="mb-8">
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4">
                            How to Transfer ChatGPT Context to Claude
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-muted">
                            <span>Last Updated: December 16, 2025</span>
                        </div>
                    </div>

                    <section className="mb-12">
                        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Quick Answer</h2>

                        <p className="text-secondary leading-relaxed mb-6">
                            To transfer ChatGPT context to Claude, export your ChatGPT conversations via OpenAI's data export tool, then paste them into Claude's Projects feature or use Context Pack to create formatted, Claude-compatible context files.
                        </p>

                        <div className="mb-6">
                            <h3 className="text-xl font-semibold mb-4">How to transfer ChatGPT context to Claude:</h3>
                            <ol className="list-decimal list-inside space-y-3 text-secondary">
                                <li>Export your ChatGPT conversation history (Settings → Data controls → Export data)</li>
                                <li>Wait for OpenAI to email you the download link (24-48 hours)</li>
                                <li>Download and extract the ZIP file</li>
                                <li>Create a new Project in Claude</li>
                                <li>Paste relevant conversation content into the Project knowledge base</li>
                                <li>Alternatively, use Context Pack to generate Claude-optimized context files</li>
                            </ol>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-3 text-green-400">What works:</h3>
                                <ul className="space-y-2 text-secondary">
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-400 mt-1">✓</span>
                                        <span>Exporting ChatGPT conversations</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-400 mt-1">✓</span>
                                        <span>Pasting content into Claude Projects</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-400 mt-1">✓</span>
                                        <span>Using Context Pack for formatted migration</span>
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold mb-3 text-red-400">What does not work:</h3>
                                <ul className="space-y-2 text-secondary">
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-400 mt-1">✗</span>
                                        <span>Direct ChatGPT-to-Claude integration</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-400 mt-1">✗</span>
                                        <span>Automatic memory sync between platforms</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-400 mt-1">✗</span>
                                        <span>Importing ChatGPT's memory feature directly</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Why Switch from ChatGPT to Claude</h2>

                        <p className="text-secondary leading-relaxed mb-4">
                            Users switch from ChatGPT to Claude for various reasons: longer context windows, different response styles, specific capabilities, or organizational requirements. Maintaining continuity when switching prevents losing valuable established context.
                        </p>

                        <p className="text-secondary leading-relaxed mb-4">
                            Claude's Projects feature is designed for exactly this use case—it allows you to provide background knowledge that persists across all conversations within that Project. This is similar to ChatGPT's memory, but requires manual setup.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Transfer Methods</h2>

                        <div className="bg-card border border-card rounded-xl p-6 mb-6 shadow-md">
                            <h3 className="text-2xl font-semibold mb-3">Using Claude Projects (Native)</h3>

                            <p className="text-secondary leading-relaxed mb-4">
                                Claude Projects allow you to attach documents and knowledge that Claude references in every conversation. You can paste your exported ChatGPT conversations directly into a Project.
                            </p>

                            <h4 className="text-lg font-semibold mb-2">Steps:</h4>
                            <ol className="list-decimal list-inside space-y-2 text-secondary mb-4">
                                <li>Export your ChatGPT data from OpenAI</li>
                                <li>Open Claude and create a new Project</li>
                                <li>Add your conversation data as Project knowledge</li>
                                <li>Start chatting—Claude will reference this context</li>
                            </ol>

                            <h4 className="text-lg font-semibold mb-2">Best for:</h4>
                            <p className="text-secondary leading-relaxed">
                                Users with a small number of conversations who want direct control over what Claude sees.
                            </p>
                        </div>

                        <div className="bg-card border border-card rounded-xl p-6 mb-6 shadow-md">
                            <h3 className="text-2xl font-semibold mb-3">Using Context Pack</h3>

                            <p className="text-secondary leading-relaxed mb-4">
                                Context Pack analyzes your ChatGPT conversations and creates formatted, Claude-optimized context files. Instead of raw conversation transcripts, you get structured behavioral profiles and knowledge summaries that Claude can process more effectively.
                            </p>

                            <h4 className="text-lg font-semibold mb-2">How it works:</h4>
                            <ol className="list-decimal list-inside space-y-2 text-secondary mb-4">
                                <li>Export ChatGPT conversations</li>
                                <li>Upload to <Link href="/" className="text-accent-primary hover:underline">Context Pack</Link></li>
                                <li>Generate a context pack</li>
                                <li>Paste into Claude (either in a Project or directly in a chat)</li>
                            </ol>

                            <h4 className="text-lg font-semibold mb-2">Best for:</h4>
                            <p className="text-secondary leading-relaxed mb-4">
                                Users with extensive ChatGPT history who want intelligent summarization rather than raw transcripts.
                            </p>

                            <Link
                                href="/how-to-port"
                                className="inline-block mt-4 text-accent-primary hover:underline font-medium"
                            >
                                See how Context Pack works →
                            </Link>
                        </div>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Frequently Asked Questions</h2>

                        <div className="space-y-8">
                            <div>
                                <h3 className="text-xl font-semibold mb-2">Can I move ChatGPT to Claude?</h3>
                                <p className="text-secondary leading-relaxed">
                                    You cannot move ChatGPT's memory feature to Claude, but you can export conversation history and load it into Claude's Projects feature or use Context Pack for formatted context transfer.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold mb-2">How do I import ChatGPT conversations into Claude?</h3>
                                <p className="text-secondary leading-relaxed">
                                    Export ChatGPT conversations via OpenAI data export, then paste the content directly into a Claude Project or use Context Pack to generate Claude-compatible context files.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold mb-2">Does Claude support ChatGPT memory import?</h3>
                                <p className="text-secondary leading-relaxed">
                                    Claude does not directly import ChatGPT memory, but its Projects feature allows you to paste exported conversation content to maintain context continuity.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Related Guides</h2>
                        <div className="space-y-4">
                            <div>
                                <Link
                                    href="/docs/move-chatgpt-memory"
                                    className="text-lg font-medium text-accent-primary hover:underline"
                                >
                                    How to Move ChatGPT Memory
                                </Link>
                                <p className="text-secondary text-sm">First step: getting your data from ChatGPT</p>
                            </div>
                            <div>
                                <Link
                                    href="/docs/transfer-chatgpt-to-gemini"
                                    className="text-lg font-medium text-accent-primary hover:underline"
                                >
                                    How to Transfer ChatGPT Context to Gemini
                                </Link>
                                <p className="text-secondary text-sm">Transfer to Google's AI instead</p>
                            </div>
                            <div>
                                <Link
                                    href="/docs/move-ai-memory-across-platforms"
                                    className="text-lg font-medium text-accent-primary hover:underline"
                                >
                                    How to Move AI Memory Across Platforms
                                </Link>
                                <p className="text-secondary text-sm">General cross-platform strategies</p>
                            </div>
                        </div>
                    </section>
                </article>
            </>
        </DocsLayout>
    );
}
