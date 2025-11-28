'use client'

import { useState } from 'react'
import { useAuth } from '../../components/AuthProvider'
import { Terminal, Copy, Check } from 'lucide-react'
import AuthModal from '../../components/AuthModal'

export default function DeveloperPage() {
    const { session, user, loading } = useAuth()
    const [copied, setCopied] = useState(false)
    const [showAuthModal, setShowAuthModal] = useState(false)

    if (loading) {
        return (
            <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-gray-800 rounded w-1/4"></div>
                        <div className="h-32 bg-gray-800 rounded"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">Developer Access Required</h1>
                    <p className="text-gray-400 mb-6">Please sign in to access developer settings and API keys.</p>
                    <button
                        onClick={() => setShowAuthModal(true)}
                        className="btn-primary"
                    >
                        Sign In
                    </button>
                    <AuthModal
                        isOpen={showAuthModal}
                        onClose={() => setShowAuthModal(false)}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center space-x-3 mb-8">
                    <Terminal className="w-8 h-8 text-purple-500" />
                    <h1 className="text-3xl font-bold text-white">Developer Settings</h1>
                </div>

                <div className="bg-card border border-border-primary rounded-lg p-6 shadow-lg">
                    <h2 className="text-xl font-semibold text-white mb-4">MCP Server Configuration</h2>
                    <p className="text-gray-400 mb-6">
                        Use your API key to configure the Universal Context Pack MCP server. This allows you to add memories directly from supported LLM interfaces.
                    </p>

                    <div className="bg-gray-900 rounded-lg p-4 border border-border-primary">
                        <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                            MCP API Key (JWT Token)
                        </label>
                        <div className="flex items-center space-x-2">
                            <code className="flex-1 bg-gray-800 text-green-400 p-3 rounded text-sm font-mono truncate border border-gray-700">
                                {session?.access_token || 'Not authenticated'}
                            </code>
                            <button
                                onClick={() => {
                                    if (session?.access_token) {
                                        navigator.clipboard.writeText(session.access_token)
                                        setCopied(true)
                                        setTimeout(() => setCopied(false), 2000)
                                    }
                                }}
                                className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors border border-transparent hover:border-gray-700"
                                title="Copy API Key"
                            >
                                {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                            <span className="text-yellow-500 font-medium">Warning:</span> This key grants access to your account. Keep it secret and do not share it.
                        </p>
                    </div>

                    <div className="mt-8">
                        <h3 className="text-lg font-medium text-white mb-3">How to use with Claude Desktop</h3>
                        <div className="prose prose-invert max-w-none text-gray-400 text-sm">
                            <p className="mb-4">
                                You don't need to be a coder to use this! Just follow these steps to connect your Universal Context Pack to Claude Desktop.
                            </p>

                            <ol className="list-decimal pl-5 space-y-4 mb-6">
                                <li>
                                    <span className="text-white font-medium">Get your API Key</span>
                                    <p className="mt-1">Copy the API Key from the box above.</p>
                                </li>
                                <li>
                                    <span className="text-white font-medium">Open Claude Desktop Config</span>
                                    <p className="mt-1">
                                        On Mac, open Terminal and run: <code className="bg-gray-800 px-1 py-0.5 rounded">open ~/Library/Application\ Support/Claude/claude_desktop_config.json</code>
                                        <br />
                                        If the file doesn't exist, create it.
                                    </p>
                                </li>
                                <li>
                                    <span className="text-white font-medium">Add the Server</span>
                                    <p className="mt-1">Paste this configuration into the file (replace <code>YOUR_API_KEY</code> with the key you copied):</p>
                                    <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto border border-border-primary mt-2">
                                        {`{
  "mcpServers": {
    "universal-context-pack": {
      "command": "node",
      "args": [
        "${process.cwd()}/mcp-server/build/index.js"
      ],
      "env": {
        "UCP_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}`}
                                    </pre>
                                    <p className="mt-2 text-xs text-gray-500">
                                        Note: You'll need to build the server first by running <code className="bg-gray-800 px-1 py-0.5 rounded">npm run build</code> in the mcp-server directory.
                                    </p>
                                </li>
                                <li>
                                    <span className="text-white font-medium">Restart Claude</span>
                                    <p className="mt-1">Quit and restart Claude Desktop. You'll see a plug icon indicating the tool is connected.</p>
                                </li>
                            </ol>

                            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                                <h4 className="text-blue-400 font-medium mb-2">Try it out!</h4>
                                <p>
                                    Once connected, just ask Claude:
                                    <br />
                                    <span className="text-white italic">"Save this conversation to my memory"</span>
                                    <br />
                                    or
                                    <br />
                                    <span className="text-white italic">"Add 'Project X deadline is Friday' to my context pack"</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-gray-800">
                        <h3 className="text-lg font-medium text-white mb-3">Using with ChatGPT</h3>
                        <div className="prose prose-invert max-w-none text-gray-400 text-sm">
                            <p className="mb-4">
                                Currently, the <strong>ChatGPT Desktop App</strong> does not natively support local MCP servers in the same "plug-and-play" way that Claude Desktop does.
                            </p>
                            <p className="mb-4">
                                To use this with ChatGPT, you would typically need to:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mb-4">
                                <li>Expose your local server to the internet (using a tool like ngrok).</li>
                                <li>Create a <strong>Custom GPT</strong>.</li>
                                <li>Add an <strong>Action</strong> that points to your exposed server URL.</li>
                            </ul>
                            <p>
                                For the smoothest experience without complex setup, we currently recommend using <strong>Claude Desktop</strong>.
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-gray-800">
                        <h3 className="text-lg font-medium text-white mb-3">Hosting for Others?</h3>
                        <div className="prose prose-invert max-w-none text-gray-400 text-sm">
                            <p className="mb-4">
                                You asked if you can host this for other people. The short answer is: <strong>Yes, but it requires changes.</strong>
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mb-4">
                                <li>
                                    <strong>Current Setup (Stdio):</strong> The current server runs locally on your machine and communicates via standard input/output. This is secure and simple for personal use.
                                </li>
                                <li>
                                    <strong>Remote Setup (SSE):</strong> To host it for others, you would need to switch the transport protocol to <strong>Server-Sent Events (SSE)</strong>. This allows remote clients to connect over HTTP.
                                </li>
                                <li>
                                    <strong>Security Warning:</strong> If you host it, <strong>DO NOT</strong> hardcode your API key. You would need to implement a way for each user to provide their own UCP API Key, or manage authentication yourself.
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-8">
                        <h3 className="text-lg font-medium text-white mb-3">Quick Start</h3>
                        <div className="prose prose-invert max-w-none text-gray-400 text-sm">
                            <p>To run the MCP server locally:</p>
                            <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto border border-border-primary mt-2">
                                {`# 1. Clone the repo and navigate to mcp-server
cd mcp-server

# 2. Install dependencies
npm install

# 3. Set your API Key
export UCP_API_KEY=your_key_above

# 4. Run the server
npm run dev`}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
