"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [roomId, setRoomId] = useState("");

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8);
    router.push(`/editor/${newRoomId}`);
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      router.push(`/editor/${roomId.trim()}`);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#0f0f0f]">
      {/* Top right — user info */}
      <div className="absolute top-4 right-6 flex items-center gap-4">
        {user ? (
          <>
            <span className="text-gray-400 text-sm">{user.username}</span>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-white text-sm transition"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="text-gray-400 hover:text-white text-sm transition"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-md transition"
            >
              Sign up
            </Link>
          </>
        )}
      </div>

      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-3">CollabCode</h1>
        <p className="text-gray-400 text-lg">
          Real-time collaborative code editor
        </p>
      </div>

      <div className="flex flex-col gap-4 w-80">
        <button
          onClick={createRoom}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
        >
          Create New Room
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-700" />
          <span className="text-gray-500 text-sm">or</span>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && joinRoom()}
          className="w-full bg-[#2d2d2d] text-white placeholder-gray-500 border border-[#3d3d3d] rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition"
        />
        <button
          onClick={joinRoom}
          className="w-full bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white font-semibold py-3 rounded-lg border border-[#3d3d3d] transition"
        >
          Join Room
        </button>
      </div>
    </main>
  );
}
