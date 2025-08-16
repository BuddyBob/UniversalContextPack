export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-32">
        <div className="text-left max-w-3xl">
          <h1 className="text-6xl font-bold text-white mb-6 leading-tight">
            move your <span className="text-purple-400">context</span>
            <br />
            across ai, <span className="text-gray-500">without</span>
            <br />
            <span className="text-gray-600">re-explaining</span>
          </h1>
          
          <p className="text-gray-400 text-lg mb-12 max-w-lg">
            Snapshot your work once, reuse it in ChatGPT, Claude, or Gemini.
          </p>

          <div className="flex items-center gap-4">
            <a 
              href="/process" 
              className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors border border-gray-700"
            >
              Generate Context Pack
            </a>
            <a 
              href="#how-it-works" 
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
            >
              See How it Works <span className="text-sm">→</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
