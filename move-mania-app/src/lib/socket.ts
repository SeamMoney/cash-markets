'use client';

import { Socket, io } from "socket.io-client";
import { BetData, CashOutData, ChatMessage, SOCKET_EVENTS } from "./types";

export const socket = io(process.env.ZION_API_URL ? "https://api.zionapi.xyz:8080" : "http://localhost:8080", {
  auth: {
    token: process.env.ZION_API_KEY || "",
  },
});

export function startRound(): boolean {
  if (socket.disconnected || !socket.connected) {
    console.error("Socket is not connected");
    return false;
  }

  socket.emit(SOCKET_EVENTS.START_ROUND);
  return true;
}

export function setNewBet(betData: BetData): boolean {
  if (socket.disconnected || !socket.connected) {
    console.error("Socket is not connected");
    return false;
  }

  socket.emit(SOCKET_EVENTS.SET_BET, betData);
  return true;
}

export function cashOutBet(
  cashOutData: CashOutData,
  privateKey: string
): boolean {
  if (socket.disconnected || !socket.connected) {
    console.error("Socket is not connected");
    return false;
  }

  const updatedCashOutData = {
    ...cashOutData,
    privateKey,
  };
  console.log("Emitting cash out event:", updatedCashOutData);
  socket.emit(SOCKET_EVENTS.CASH_OUT, updatedCashOutData);
  return true;
}

export function sendMessage(message: ChatMessage): boolean {
  if (socket.disconnected || !socket.connected) {
    console.error("Socket is not connected");
    return false;
  }

  socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, message);
  return true;
}
