"use client";

interface OutputPanelProps {
  output: string;
  error: string;
  isRunning: boolean;
}

export default function OutputPanel({
  output,
  error,
  isRunning,
}: OutputPanelProps) {
  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] border-t border-[#3d3d3d]">
      {/* Output Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
          Output
        </span>
        {isRunning && (
          <span className="text-blue-400 text-xs animate-pulse">
            Running...
          </span>
        )}
      </div>

      {/* Output Content */}
      <div className="flex-1 overflow-auto p-4 font-mono text-sm">
        {isRunning && <p className="text-gray-500">Executing code...</p>}

        {!isRunning && !output && !error && (
          <p className="text-gray-600">Run your code to see output here.</p>
        )}

        {/* stdout */}
        {output && (
          <pre className="text-green-400 whitespace-pre-wrap">{output}</pre>
        )}

        {/* stderr */}
        {error && (
          <pre className="text-red-400 whitespace-pre-wrap">{error}</pre>
        )}
      </div>
    </div>
  );
}
