export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface Language {
  id: string;
  label: string;
  pistonId: string;
  version: string;
}

export const LANGUAGES: Language[] = [
  {
    id: "javascript",
    label: "JavaScript",
    pistonId: "javascript",
    version: "",
  },
  {
    id: "typescript",
    label: "TypeScript",
    pistonId: "typescript",
    version: "",
  },
  { id: "python", label: "Python", pistonId: "python", version: "" },
];

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export async function executeCode(
  language: Language,
  code: string,
): Promise<ExecutionResult> {
  // Now calls our backend instead of Piston directly
  const response = await fetch(`${BACKEND_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: language.pistonId,
      version: language.version,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error("Execution failed");
  }

  const data = await response.json();

  const stdout = data.run?.stdout || "";
  const stderr = data.run?.stderr || data.compile?.stderr || "";
  const exitCode = data.run?.code ?? 0;

  return { stdout, stderr, exitCode };
}
