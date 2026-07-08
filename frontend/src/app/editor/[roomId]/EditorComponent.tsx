"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Editor, { OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import { getSocket } from "@/lib/socket";
import { executeCode, LANGUAGES, Language } from "@/lib/piston";
import OutputPanel from "./OutputPanel";
import * as monaco from "monaco-editor";
import { useAuth } from "@/context/AuthContext";

interface RoomUser {
  socketId: string;
  username: string;
}

function generateColor(): string {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default function EditorComponent() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [users, setUsers] = useState<RoomUser[]>([]);

  const { user } = useAuth();
  const [username] = useState(() => {
    return (
      user?.username ||
      "Guest_" + Math.random().toString(36).substring(2, 6).toUpperCase()
    );
  });
  const [userColor] = useState(() => generateColor());

  const [selectedLanguage, setSelectedLanguage] = useState<Language>(
    LANGUAGES[0],
  );
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  const ydocRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const pendingUpdates = useRef<number[][]>([]);
  const editorReady = useRef(false);

  const handleRunCode = async () => {
    if (!editorRef.current) return;
    const code = editorRef.current.getValue();
    if (!code.trim()) return;

    const socket = getSocket();

    // Tell everyone we're running code
    setIsRunning(true);
    setShowOutput(true);
    setOutput("");
    setError("");

    // Broadcast "running" state to room
    socket.emit("code-running", { roomId });

    try {
      const result = await executeCode(selectedLanguage, code);

      // Broadcast result to everyone in room
      socket.emit("code-output", {
        roomId,
        output: {
          stdout: result.stdout,
          stderr: result.stderr,
          code: result.exitCode,
          language: selectedLanguage.label,
        },
      });
    } catch (err) {
      socket.emit("code-output", {
        roomId,
        output: {
          stdout: "",
          stderr: "Failed to execute code. Please try again.",
          code: 1,
          language: selectedLanguage.label,
        },
      });
    }
  };

  const handleLanguageChange = (languageId: string) => {
    const lang = LANGUAGES.find((l) => l.id === languageId);
    if (!lang) return;
    setSelectedLanguage(lang);
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, lang.id);
      }
    }
  };

  useEffect(() => {
    const socket = getSocket();

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const awareness = new Awareness(ydoc);
    awarenessRef.current = awareness;

    awareness.setLocalStateField("user", {
      name: username,
      color: userColor,
    });

    socket.connect();
    socket.emit("join-room", { roomId, username });

    socket.on("room-users", ({ users }: { users: RoomUser[] }) => {
      setUsers(users);
    });

    socket.on("sync-state", ({ update }: { update: number[] }) => {
      if (editorReady.current) {
        Y.applyUpdate(ydoc, new Uint8Array(update));
      } else {
        pendingUpdates.current.push(update);
      }
    });

    socket.on("code-update", ({ update }: { update: number[] }) => {
      if (editorReady.current) {
        Y.applyUpdate(ydoc, new Uint8Array(update));
      } else {
        pendingUpdates.current.push(update);
      }
    });

    socket.on("awareness-update", ({ update }: { update: number[] }) => {
      applyAwarenessUpdate(awareness, new Uint8Array(update), socket);
    });

    ydoc.on("update", (update: Uint8Array) => {
      socket.emit("code-update", {
        roomId,
        update: Array.from(update),
      });
    });

    awareness.on(
      "update",
      ({
        added,
        updated,
        removed,
      }: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        const changedClients = added.concat(updated, removed);
        const update = encodeAwarenessUpdate(awareness, changedClients);
        socket.emit("awareness-update", {
          roomId,
          update: Array.from(update),
        });
      },
    );

    // Listen for output broadcast from anyone in room
    socket.on(
      "code-output",
      ({
        output,
      }: {
        output: {
          stdout: string;
          stderr: string;
          code: number;
          language: string;
        };
      }) => {
        setOutput(output.stdout);
        setError(output.stderr);
        setShowOutput(true);
        setIsRunning(false);
      },
    );

    socket.on("code-running", () => {
      setIsRunning(true);
      setShowOutput(true);
      setOutput("");
      setError("");
    });

    return () => {
      socket.off("room-users");
      socket.off("sync-state");
      socket.off("code-update");
      socket.off("awareness-update");
      socket.off("code-output");
      socket.off("code-running");
      awareness.destroy();
      if (bindingRef.current) bindingRef.current.destroy();
      if (ydocRef.current) ydocRef.current.destroy();
      socket.disconnect();
    };
  }, [roomId, username, userColor]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;

    const ydoc = ydocRef.current!;
    const awareness = awarenessRef.current!;
    const ytext = ydoc.getText("code");

    const binding = new MonacoBinding(
      ytext,
      editor.getModel()!,
      new Set([editor]),
      awareness,
    );
    bindingRef.current = binding;

    editorReady.current = true;
    pendingUpdates.current.forEach((update) => {
      Y.applyUpdate(ydoc, new Uint8Array(update));
    });
    pendingUpdates.current = [];

    awareness.on("change", () => {
      const states = awareness.getStates();
      states.forEach((state, clientId) => {
        if (clientId === ydoc.clientID) return;
        if (!state.user) return;

        const color = state.user.color;
        const name = state.user.name;
        const styleId = `cursor-style-${clientId}`;

        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
          styleEl = document.createElement("style");
          styleEl.id = styleId;
          document.head.appendChild(styleEl);
        }

        // Fixed cursor label — now appears BELOW cursor, not above code
        styleEl.innerHTML = `
          .yRemoteSelection-${clientId} {
            background-color: ${color}33;
          }
          .yRemoteSelectionHead-${clientId} {
            border-left: 2px solid ${color};
            position: relative;
          }
          .yRemoteSelectionHead-${clientId}::after {
            content: "${name}";
            background-color: ${color};
            color: #000000;
            font-size: 10px;
            font-weight: 700;
            padding: 0px 4px;
            border-radius: 0 3px 3px 3px;
            position: absolute;
            top: 18px;
            left: -2px;
            white-space: nowrap;
            pointer-events: none;
            z-index: 100;
          }
        `;
      });
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#2d2d2d] border-b border-[#3d3d3d]">
        <h1 className="text-white font-bold text-lg">CollabCode</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {users.map((user) => (
              <div
                key={user.socketId}
                className="flex items-center gap-1.5 bg-[#3d3d3d] px-3 py-1 rounded-full"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: userColor }}
                />
                <span className="text-gray-300 text-xs">{user.username}</span>
              </div>
            ))}
          </div>

          <span className="text-gray-500 text-sm">Room: {roomId}</span>

          <select
            value={selectedLanguage.id}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="bg-[#3d3d3d] text-gray-300 text-sm px-3 py-1.5 rounded-md border border-[#4d4d4d] outline-none cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm px-4 py-1.5 rounded-md transition"
          >
            {isRunning ? "Running..." : "Run Code"}
          </button>
        </div>
      </div>

      {/* Editor + Output */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={showOutput ? "h-[60%]" : "h-full"}>
          <Editor
            height="100%"
            language={selectedLanguage.id}
            defaultValue=""
            theme="vs-dark"
            onMount={handleEditorMount}
            options={{
              fontSize: 16,
              fontFamily: "JetBrains Mono, Fira Code, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
              tabSize: 2,
              lineNumbers: "on",
              renderLineHighlight: "all",
              cursorBlinking: "smooth",
              smoothScrolling: true,
            }}
          />
        </div>

        {showOutput && (
          <div className="h-[40%]">
            <OutputPanel output={output} error={error} isRunning={isRunning} />
          </div>
        )}
      </div>
    </div>
  );
}
