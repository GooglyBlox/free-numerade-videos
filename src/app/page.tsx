import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <span className="text-lg font-semibold">Numerade Video Viewer API</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <section className="max-w-3xl mx-auto space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold">Numerade Video Access API</h1>
            <p className="text-lg text-zinc-700 dark:text-zinc-300">
              A simple API endpoint for programmatically accessing Numerade educational videos.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">API Usage</h2>
              
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <h3 className="font-semibold mb-2">GET Request</h3>
                  <code className="font-mono text-sm bg-zinc-100 dark:bg-zinc-800 p-2 rounded block">
                    GET /api/numerade?url=https://www.numerade.com/questions/your-question-url
                  </code>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Redirects directly to the video file.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <h3 className="font-semibold mb-2">POST Request</h3>
                  <code className="font-mono text-sm bg-zinc-100 dark:bg-zinc-800 p-2 rounded block">
                    POST /api/numerade
                    {"\n"}Content-Type: application/json
                    {"\n"}
                    {"\n"}{"{"} 
                    {"\n"}  "url": "https://www.numerade.com/questions/your-question-url"
                    {"\n"}{"}"}</code>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Returns a JSON response with video information.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Response Format</h2>
              <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <code className="font-mono text-sm bg-zinc-100 dark:bg-zinc-800 p-2 rounded block">
                  {"{"}
                  {"\n"}  "url": "https://cdn.numerade.com/encoded/...",
                  {"\n"}  "title": "Question Title"
                  {"\n"}{"}"}</code>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-12">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Created by GooglyBlox
          </span>
          <div className="flex gap-4">
            <Link 
              href="https://x.com/GooglyBlox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Twitter
            </Link>
            <Link 
              href="https://github.com/GooglyBlox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              GitHub
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}