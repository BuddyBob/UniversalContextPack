import type { Metadata } from 'next';
import Link from 'next/link';
import DocsLayout from '@/components/DocsLayout';

export const metadata: Metadata = {
    title: 'How to Move ChatGPT Memory | Context Pack',
    description: 'Learn how to move ChatGPT memory and personal context. Step-by-step guide covering native limitations, workarounds, and tools like Context Pack for portable AI memory.',
    openGraph: {
        title: 'How to Move ChatGPT Memory',
        description: 'Learn how to move ChatGPT memory and personal context. Step-by-step guide covering native limitations, workarounds, and tools like Context Pack for portable AI memory.',
        url: 'https://www.context-pack.com/docs/move-chatgpt-memory',
        type: 'article',
        images: [{
            url: 'https://www.context-pack.com/og-image.png',
            width: 1200,
            height: 630,
            alt: 'Context Pack - Move ChatGPT Memory'
        }]
    },
    twitter: {
        card: 'summary_large_image',
        title: 'How to Move ChatGPT Memory',
        description: 'Step-by-step guide to moving ChatGPT memory with workarounds and tools.',
        images: ['https://www.context-pack.com/og-image.png']
    }
};

export default function ExportChatGPTMemoryPage() {
    const schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Article",
                "headline": "How to Move ChatGPT Memory",
                "description": "Learn how to move ChatGPT memory and personal context. Step-by-step guide covering native limitations, workarounds, and tools like Context Pack for portable AI memory.",
                "image": "https://www.context-pack.com/og-image.png",
                "datePublished": "2025-12-16",
                "dateModified": "2025-12-16",
                "author": {
                    "@type": "Organization",
                    "name": "Context Pack",
                    "url": "https://www.context-pack.com"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "Context Pack",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://www.context-pack.com/Logo2.png",
                        "width": 180,
                        "height": 180
                    }
                },
                "mainEntityOfPage": {
                    "@type": "WebPage",
                    "@id": "https://www.context-pack.com/docs/move-chatgpt-memory"
                }
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": "Can I move ChatGPT personal memories?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "No, ChatGPT does not provide a direct export function for the memory feature. You can manually copy individual memories from the settings page, but there is no bulk export option."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Where do I manage ChatGPT memories?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Open ChatGPT, click your profile icon, select Settings, then Personalization. Under the Memory section, click Manage to view, edit, or delete stored memories."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "How do I backup my ChatGPT memories?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Navigate to Settings > Personalization > Manage Memory, then manually copy each memory to a text file. Alternatively, use the OpenAI data export tool to download full conversation history, then analyze with Context Pack."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Can I move ChatGPT memories to a different account?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "ChatGPT memory is account-specific and cannot be transferred directly. You must manually recreate memories in the new account by copying them from the old account's settings, or use Context Pack to migrate portable context."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "How do I transfer ChatGPT context to Claude?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Export your ChatGPT conversations via OpenAI's data export tool, then paste them directly into Claude's Projects feature. Alternatively, use Context Pack to create formatted context files compatible with Claude."
                        }
                    }
                ]
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://www.context-pack.com"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Documentation",
                        "item": "https://www.context-pack.com/docs"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Move ChatGPT Memory",
                        "item": "https://www.context-pack.com/docs/move-chatgpt-memory"
                    }
                ]
            }
        ]
    };

    return (
        <DocsLayout>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />

            <article className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4">
                        Moving ChatGPT Memory
                    </h1>
                    <div className="flex items-center gap-4 text-sm text-muted">
                        <span>Last Updated: December 16, 2025</span>
                        <span>•</span>
                        <span>Scope: Data Exports, JSON Parsing, conversations.json</span>
                    </div>
                </div>

                {/* Current State Section */}
                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">The Current State of Data Portability</h2>

                    <p className="text-secondary leading-relaxed mb-6">
                        OpenAI allows users to export their data, but it is important to distinguish between <strong className="text-primary">Compliance</strong> (GDPR/Archives) and <strong className="text-primary">Portability</strong> (Moving context to another tool).
                    </p>

                    <p className="text-secondary leading-relaxed mb-6">
                        While a native export function exists, it produces a massive, unstructured dataset designed for archival and not for editing or transferring to other AI models.
                    </p>
                </section>

                {/* The Native Export Section */}
                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">The Native Export (The "Haystack")</h2>

                    <p className="text-secondary leading-relaxed mb-4">
                        You can request your data via <span className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">Settings &gt; Data Controls &gt; Export Data</span>.
                    </p>
                    <p className="text-secondary leading-relaxed mb-6">
                        This generates a <span className="font-mono text-sm">.zip</span> file containing <span className="font-mono text-sm">conversations.json</span>.
                    </p>

                    <h3 className="text-xl font-semibold mb-4">Why this file is problematic:</h3>
                    <ul className="space-y-3 text-secondary mb-6">
                        <li className="flex items-start gap-3">
                            <span className="text-red-400 mt-1 font-bold">•</span>
                            <div>
                                <strong className="text-primary">Unmanageable Size:</strong> For active users, <span className="font-mono text-sm">conversations.json</span> often exceeds 100MB+ of raw text.
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-red-400 mt-1 font-bold">•</span>
                            <div>
                                <strong className="text-primary">No "Memory" Isolation:</strong> The specific "Memory" nodes (the facts visible in Settings → Personalization) are often mixed into the raw conversation logs or excluded entirely from the structured JSON.
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-red-400 mt-1 font-bold">•</span>
                            <div>
                                <strong className="text-primary">Read-Only:</strong> You cannot edit this file and upload it back to ChatGPT.
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-red-400 mt-1 font-bold">•</span>
                            <div>
                                <strong className="text-primary">Incompatible:</strong> Neither Claude (Projects) nor Gemini can ingest a raw <span className="font-mono text-sm">conversations.json</span> file due to token limits.
                            </div>
                        </li>
                    </ul>

                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                        <p className="text-sm text-gray-700">
                            <strong className="text-blue-700">Technical Note:</strong> <span className="font-mono text-sm">conversations.json</span> is a linear log of every message ever sent. It is the "Haystack." To be useful, you need to find the "Needles"—the specific facts and preferences buried within those millions of tokens.
                        </p>
                    </div>
                </section>

                {/* Reality Check Section */}
                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Why Manual Processing is Nearly Impossible</h2>

                    <div className="bg-red-50 border-l-4 border-red-500 p-6 mb-6">
                        <p className="text-sm text-gray-800 font-semibold mb-3">
                            Working with a raw <span className="font-mono">conversations.json</span> file is <strong className="text-red-700">almost impossible</strong> without specialized tooling.
                        </p>
                    </div>

                    <h3 className="text-xl font-semibold mb-4">The Impossible Scale</h3>
                    <p className="text-secondary leading-relaxed mb-4">
                        If you've been using ChatGPT for more than a few months, your <span className="font-mono text-sm">conversations.json</span> file is likely:
                    </p>
                    <ul className="space-y-3 text-secondary mb-6 ml-6">
                        <li className="flex items-start gap-3">
                            <span className="text-red-500 mt-1 font-bold">→</span>
                            <div>
                                <strong className="text-primary">100MB to 500MB+ in size</strong> — Try opening a 300MB text file in any editor. Even modern IDEs will struggle or crash.
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-red-500 mt-1 font-bold">→</span>
                            <div>
                                <strong className="text-primary">Millions of tokens</strong> — A typical active user has 500,000 to 2,000,000+ tokens of conversation history.
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-red-500 mt-1 font-bold">→</span>
                            <div>
                                <strong className="text-primary">Thousands of conversations</strong> — Each one buried in a nested JSON structure with metadata, timestamps, and formatting tokens.
                            </div>
                        </li>
                    </ul>

                    <h3 className="text-xl font-semibold mb-4">Why Even AI Can't Help You</h3>
                    <p className="text-secondary leading-relaxed mb-4">
                        You might think: <em>"I'll just upload this to ChatGPT/Claude/Gemini and ask it to extract the important parts."</em>
                    </p>
                    <p className="text-secondary leading-relaxed mb-6">
                        <strong className="text-red-600">This will not work.</strong> Here's why:
                    </p>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
                        <div className="space-y-4 text-sm text-gray-700">
                            <div className="flex items-start gap-3">
                                <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">ChatGPT</span>
                                <p className="flex-1">
                                    <strong>128k token limit</strong> — Your file is 2 million tokens. The upload will be rejected or truncated beyond recognition.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">Claude</span>
                                <p className="flex-1">
                                    <strong>200k token limit</strong> — Even if you somehow fit it in, the model will "forget" everything after the first 200k tokens due to context overflow.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">Gemini</span>
                                <p className="flex-1">
                                    <strong>1M+ token window</strong> — Closest option, but processing 500MB of JSON in a chat interface is impractical, slow, and expensive (thousands of input tokens charged per analysis).
                                </p>
                            </div>
                        </div>
                    </div>

                    <p className="text-secondary leading-relaxed mb-6">
                        <strong className="text-red-600">Doing anything useful with the export is almost impossible.</strong>
                    </p>

                    <div className="bg-blue-50 border-l-4 border-blue-500 p-6">
                        <h4 className="font-semibold text-blue-900 mb-2">The Bottom Line</h4>
                        <p className="text-sm text-blue-800 leading-relaxed">
                            OpenAI's export gives you your data back for <strong>compliance</strong>, not <strong>portability</strong>. To actually <em>use</em> this data—to move it, edit it, or transfer it to another AI—you need an automated ETL (Extract, Transform, Load) pipeline. That's exactly what Context Pack provides.
                        </p>
                    </div>
                </section>

                {/* Solution: Parsing & Analysis */}
                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">The Solution: Parsing & Analysis</h2>

                    <p className="text-secondary leading-relaxed mb-6">
                        Since the native file is unusable in its raw state, you must use a parser to extract the signal from the noise.
                    </p>

                    {/* Method 1: Context Pack */}
                    <div className="bg-card border border-card rounded-xl p-6 mb-6 shadow-md">
                        <h3 className="text-2xl font-semibold mb-3">Method 1: Context Pack (Recommended)</h3>

                        <p className="text-secondary leading-relaxed mb-4">
                            Context Pack acts as an <strong className="text-primary">ETL</strong> (Extract, Transform, Load) tool for your AI memory. It ingests the massive <span className="font-mono text-sm">conversations.json</span> file and programmatically extracts the relevant context.
                        </p>

                        <h4 className="text-lg font-semibold mb-2 mt-4">How it works:</h4>
                        <ul className="space-y-3 text-secondary mb-4">
                            <li className="flex items-start gap-3">
                                <span className="font-bold text-primary">Ingest:</span>
                                <span>Upload your <span className="font-mono text-sm">conversations.json</span> to the Context Pack dashboard.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="font-bold text-primary">Analyze:</span>
                                <span>The engine scans for semantic patterns facts, coding styles, project details, interests, and user preferences.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="font-bold text-primary">Edit:</span>
                                <span>Unlike the raw JSON, Context Pack presents a Curated Memory Graph. You can edit, merge, or delete specific facts.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="font-bold text-primary">Format:</span>
                                <span>Download a clean System Prompt or Markdown file (typically &lt;5KB) that is compatible with Claude, Gemini, or a new ChatGPT instance.</span>
                            </li>
                        </ul>

                        <Link
                            href="https://www.youtube.com/embed/ywnsNDI1imY"
                            target="_blank"
                            className="inline-block mt-4 text-accent-primary hover:underline font-medium"
                        >
                            See how Context Pack works →
                        </Link>
                    </div>

                </section>

                {/* Comparison Table */}
                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Comparison: Raw Export vs. Processed Context</h2>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Feature</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">OpenAI Native Export</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Context Pack Processed</th>
                                </tr>
                            </thead>
                            <tbody className="text-secondary text-sm">
                                <tr>
                                    <td className="border border-gray-300 px-4 py-2 font-medium">File Format</td>
                                    <td className="border border-gray-300 px-4 py-2">Raw JSON (conversations.json)</td>
                                    <td className="border border-gray-300 px-4 py-2">Optimized Markdown / System Prompt</td>
                                </tr>
                                <tr>
                                    <td className="border border-gray-300 px-4 py-2 font-medium">File Size</td>
                                    <td className="border border-gray-300 px-4 py-2">50MB - 500MB+</td>
                                    <td className="border border-gray-300 px-4 py-2">2KB - 10KB</td>
                                </tr>
                                <tr>
                                    <td className="border border-gray-300 px-4 py-2 font-medium">Content</td>
                                    <td className="border border-gray-300 px-4 py-2">Every message ever sent</td>
                                    <td className="border border-gray-300 px-4 py-2">Distilled facts & active context</td>
                                </tr>
                                <tr>
                                    <td className="border border-gray-300 px-4 py-2 font-medium">Editable?</td>
                                    <td className="border border-gray-300 px-4 py-2">No (Text blob)</td>
                                    <td className="border border-gray-300 px-4 py-2">Yes (Visual Graph Editor)</td>
                                </tr>
                                <tr>
                                    <td className="border border-gray-300 px-4 py-2 font-medium">Portable?</td>
                                    <td className="border border-gray-300 px-4 py-2">No (Too large for context windows)</td>
                                    <td className="border border-gray-300 px-4 py-2">Yes (Fits in any model)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* FAQ Section */}
                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Frequently Asked Questions</h2>

                    <div className="space-y-8">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Why can't I just upload conversations.json to Claude?</h3>
                            <p className="text-secondary leading-relaxed">
                                Claude has a context window limit (e.g., 200k tokens). A typical conversations.json file contains millions of tokens. Uploading it will either fail or force the model to "forget" the beginning of the file immediately.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold mb-2">Does editing conversations.json change my ChatGPT memory?</h3>
                            <p className="text-secondary leading-relaxed">
                                No. The export is an offline snapshot. Changing the file on your computer has zero effect on your actual ChatGPT account. To change your memory, you must use the Context Pack editor to create a new "Instruction Set" that you paste into a new instance.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold mb-2">Can I export ChatGPT personal memories?</h3>
                            <p className="text-secondary leading-relaxed">
                                No, ChatGPT does not provide a direct export function for the memory feature. You can manually copy individual memories from the settings page, but there is no bulk export option.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold mb-2">Where do I manage ChatGPT memories?</h3>
                            <p className="text-secondary leading-relaxed">
                                Open ChatGPT, click your profile icon, select "Settings," then "Personalization." Under the Memory section, click "Manage" to view, edit, or delete stored memories.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold mb-2">Can I move ChatGPT memories to a different account?</h3>
                            <p className="text-secondary leading-relaxed">
                                ChatGPT memory is account-specific and cannot be transferred directly. You must manually recreate memories in the new account by copying them from the old account's settings, or use Context Pack to migrate portable context.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold mb-2">How long does OpenAI take to send my data export?</h3>
                            <p className="text-secondary leading-relaxed">
                                OpenAI typically processes data export requests within 30 minutes to an hour. You will receive an email with a download link when your export is ready.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Related Guides */}
                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Related Guides</h2>
                    <div className="space-y-4">
                        <div>
                            <Link
                                href="/docs/move-chatgpt-memory-to-another-account"
                                className="text-lg font-medium text-accent-primary hover:underline"
                            >
                                How to Move ChatGPT Memory to Another Account
                            </Link>
                            <p className="text-secondary text-sm">Transfer memories between OpenAI accounts</p>
                        </div>
                        <div>
                            <Link
                                href="/docs/manage-chatgpt-personal-memory"
                                className="text-lg font-medium text-accent-primary hover:underline"
                            >
                                How to Manage ChatGPT Personal Memory
                            </Link>
                            <p className="text-secondary text-sm">View, edit, and delete stored memories</p>
                        </div>
                        <div>
                            <Link
                                href="/docs/chatgpt-memory-vs-chat-history"
                                className="text-lg font-medium text-accent-primary hover:underline"
                            >
                                ChatGPT Memory vs Chat History: What's the Difference?
                            </Link>
                            <p className="text-secondary text-sm">Understand different data types</p>
                        </div>
                        <div>
                            <Link
                                href="/docs/transfer-chatgpt-to-claude"
                                className="text-lg font-medium text-accent-primary hover:underline"
                            >
                                How to Transfer ChatGPT Context to Claude
                            </Link>
                            <p className="text-secondary text-sm">Cross-platform context transfer</p>
                        </div>
                    </div>
                </section>
            </article>
        </DocsLayout>
    );
}
