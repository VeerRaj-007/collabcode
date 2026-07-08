"use client";
import dynamic from "next/dynamic";

// This tells Next.js:
// "Only load this component in the browser, never on the server"
const EditorComponent = dynamic(() => import("./EditorComponent"), {
  ssr: false, // <-- this is the key line
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-[#1e1e1e]">
      <p className="text-gray-400 text-sm">Loading editor...</p>
    </div>
  ),
});

export default function EditorPage() {
  return <EditorComponent />;
}
