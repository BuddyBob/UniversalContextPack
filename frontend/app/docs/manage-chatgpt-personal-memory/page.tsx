import type { Metadata } from 'next';
import Link from 'next/link';
import DocsLayout from '@/components/DocsLayout';

export const metadata: Metadata = {
    title: 'How to Manage ChatGPT Personal Memory | Context Pack',
    description: 'View, edit, and delete ChatGPT memories. Complete guide to managing what ChatGPT remembers about you, including privacy controls and memory settings.',
    openGraph: {
        title: 'How to Manage ChatGPT Personal Memory',
        description: 'View, edit, and delete ChatGPT memories. Complete guide to managing what ChatGPT remembers about you, including privacy controls and memory settings.',
        url: 'https://www.context-pack.com/docs/manage-chatgpt-personal-memory',
        type: 'article',
    },
};

export default function ManageChatGPTMemoryPage() {
    return (
        <DocsLayout>
            <article className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4">
                        How to Manage ChatGPT Personal Memory
                    </h1>
                    <div className="flex items-center gap-4 text-sm text-muted">
                        <span>Last Updated: December 16, 2025</span>
                    </div>
                </div>

                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Quick Answer</h2>

                    <p className="text-secondary leading-relaxed mb-6">
                        To manage ChatGPT memories, open Settings → Personalization → Manage Memory. Here you can view all stored memories, delete specific memories, or turn memory off entirely.
                    </p>

                    <div className="mb-6">
                        <h3 className="text-xl font-semibold mb-4">How to manage ChatGPT personal memory:</h3>
                        <ol className="list-decimal list-inside space-y-3 text-secondary">
                            <li>Open ChatGPT and click your profile icon</li>
                            <li>Select "Settings"</li>
                            <li>Navigate to "Personalization"</li>
                            <li>Click "Manage" under the Memory section</li>
                            <li>View, delete individual memories, or clear all memories</li>
                            <li>Toggle "Memory" switch to turn the feature on/off</li>
                        </ol>
                    </div>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Managing Your Memories</h2>

                    <h3 className="text-xl font-semibold mb-4 mt-8">Viewing Stored Memories</h3>
                    <p className="text-secondary leading-relaxed mb-4">
                        The memory management page shows all facts ChatGPT has learned about you. Each memory is displayed as a separate item with an X button to delete it.
                    </p>

                    <h3 className="text-xl font-semibold mb-4 mt-8">Deleting Specific Memories</h3>
                    <p className="text-secondary leading-relaxed mb-4">
                        Click the X icon next to any memory to remove it. ChatGPT will immediately forget that information. You can delete as many individual memories as you want.
                    </p>

                    <h3 className="text-xl font-semibold mb-4 mt-8">Turning Memory Off</h3>
                    <p className="text-secondary leading-relaxed mb-4">
                        Use the Memory toggle switch to disable the feature entirely. When memory is off, ChatGPT will not store new memories, but existing memories remain (unless you delete them manually).
                    </p>

                    <h3 className="text-xl font-semibold mb-4 mt-8">Clearing All Memories</h3>
                    <p className="text-secondary leading-relaxed mb-4">
                        To clear all memories at once, use the "Clear ChatGPT's memory" option in the memory management settings. This is irreversible—make sure to back up important memories first.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6">Frequently Asked Questions</h2>

                    <div className="space-y-8">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Where do I find my ChatGPT memories?</h3>
                            <p className="text-secondary leading-relaxed">
                                Open ChatGPT, click your profile icon, select Settings, then Personalization. Under Memory, click Manage to view all stored memories.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold mb-2">How do I delete ChatGPT memories?</h3>
                            <p className="text-secondary leading-relaxed">
                                Go to Settings → Personalization → Manage Memory. Click the X icon next to any memory to delete it. You can also turn off memory entirely in this section.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold mb-2">Can I edit ChatGPT memories?</h3>
                            <p className="text-secondary leading-relaxed">
                                You cannot edit memories directly. To update a memory, delete the incorrect one and share the correct information in a new conversation for ChatGPT to remember.
                            </p>
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
                            <p className="text-secondary text-sm">Back up your memories before managing</p>
                        </div>
                        <div>
                            <Link href="/docs/chatgpt-memory-limitations" className="text-lg font-medium text-accent-primary hover:underline">
                                ChatGPT Memory Limitations
                            </Link>
                            <p className="text-secondary text-sm">What memory can and cannot do</p>
                        </div>
                        <div>
                            <Link href="/docs/chatgpt-memory-vs-chat-history" className="text-lg font-medium text-accent-primary hover:underline">
                                ChatGPT Memory vs Chat History
                            </Link>
                            <p className="text-secondary text-sm">Understanding the difference</p>
                        </div>
                    </div>
                </section>
            </article>
        </DocsLayout>
    );
}
