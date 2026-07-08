import { io, Socket } from "socket.io-client";

const BACKEND_URL = "http://localhost:5000";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: false,
    });
  }
  return socket;
};
