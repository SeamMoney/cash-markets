import http from "http";
import { AptosClient } from "aptos";
import { Server } from "socket.io";
import { ChatMessage, SOCKET_EVENTS } from "./types";
import {
  addBetToPlayerList,
  addCashOutToPlayerList,
  addChatMessage,
  clearPlayerList,
  createGame,
  endGame,
  getUser,
} from "./database";
import express from "express";
import crypto from 'crypto';
import { calculateCrashPoint } from "./crashPoint";
import { createNewGame, endGame as endGameAptos, handleCashOut } from "./aptos";
require('dotenv').config();
const COUNTDOWN = 20 * 1000;
const SUMMARY = 5 * 1000;
const EXPONENTIAL_FACTOR = 1.06;
var cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors());
const portHttps = 8080;
const aptosClient = new AptosClient(`${process.env.NODE_URL}`);
// USE FOR PRODUCTION
import https from 'https';
import fs from 'fs';
const CERT_PATH = "/etc/letsencrypt/live/api.zionapi.xyz/fullchain.pem"
const KEY_PATH = "/etc/letsencrypt/live/api.zionapi.xyz/privkey.pem"

const options = {
  // key: fs.readFileSync(KEY_PATH),
  // cert: fs.readFileSync(CERT_PATH)
  rejectUnauthorized: true
};
const httpsServer = https.createServer(options, app);
httpsServer.listen(portHttps, () => {
  console.log('HTTPs Server running on port ', portHttps);
  cycleRounds();
});
const io = new Server(httpsServer, {
  cors: {
    origin: process.env.ZION_APP_URL ? [process.env.ZION_APP_URL, "http://localhost:3000", "https://zionapi.xyz", "https://api.zionapi.xyz"] : true,
    credentials: true,
  },
  connectionStateRecovery: {}
});
// httpsServer.listen(portHttps, () => {
//   console.log("Server running on port:", portHttps);
// });
const getDateNow = async () => {
  const ledgerInfo = await aptosClient.getLedgerInfo();
  const timestampInMicroseconds = ledgerInfo.ledger_timestamp;
  return Math.floor(parseInt(timestampInMicroseconds) / 1000);
}
io.on("connection", (socket) => {
  console.log("New client connected, socket ID:", socket.id);
  socket.onAny((eventName, ...args) => {
    console.log(`Received event: ${eventName}`, args);
  });
  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected, socket ID: ${socket.id}, reason: ${reason}`);
  });
  socket.onAny((eventName, ...args) => {
    if (!Object.values(SOCKET_EVENTS).includes(eventName)) {
      console.log(`Unhandled event received: ${eventName}`, args);
    }
  });
  socket.on(SOCKET_EVENTS.SET_BET, async (betData) => {
    await addBetToPlayerList(betData);
    io.emit(SOCKET_EVENTS.BET_CONFIRMED, betData);
  });

  socket.on(SOCKET_EVENTS.CASH_OUT, async (data, callback) => {
    console.log('Cash-out process started for:', data);
    try {
      console.log('Received cash-out request:', data);
      const { playerEmail, playerAddress, privateKey, cashOutMultiplier, roundId } = data;
      const cashOutAmount = Math.floor(cashOutMultiplier * 100);
      console.log('Calling handleCashOut with:', playerAddress, cashOutAmount);
      // const blockchainRes = await handleCashOut(playerAddress, cashOutAmount);
      // console.log('handleCashOut function:', handleCashOut);

      const cashOutData = {
        roundId: roundId,
        playerEmail: playerEmail,
        cashOutMultiplier: cashOutMultiplier,
        playerAddress: playerAddress,
      };
      console.log('Attempting to add cash-out to player list:', cashOutData);
      const updateSuccess = await addCashOutToPlayerList(cashOutData);
      if (updateSuccess) {
        console.log('Successfully added cash-out to player list');
        console.log('Emitting CASH_OUT_CONFIRMED:', cashOutData);
        io.emit(SOCKET_EVENTS.CASH_OUT_CONFIRMED, cashOutData);
        socket.emit(SOCKET_EVENTS.CASH_OUT_RESULT, { success: true });
      } else {
        console.error('Failed to update player list');
        socket.emit(SOCKET_EVENTS.CASH_OUT_RESULT, { success: false, error: 'Failed to update player list' });
      }

    } catch (error) {
      console.error('Error in cash out:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      socket.emit(SOCKET_EVENTS.CASH_OUT_RESULT, { success: false, error: 'Internal server error' });
    }
    console.log('Cash-out process completed');
  });
  socket.on(SOCKET_EVENTS.START_ROUND, async () => {
    console.log("CREATE")
    await clearPlayerList();
    let blockchainTxn = await createNewGame('house_secret', 'salt')
    console.log("blockchainTxn", blockchainTxn)
    if (blockchainTxn === null) {
      console.error("Error creating new game")
      return
    }
    const crashPoint = calculateCrashPoint(blockchainTxn.randomNumber, 'house_secretsalt');
    const startTime = Math.floor(blockchainTxn.startTime / 1000);
    const gameId = Math.random().toString(36).substring(7);
    await createGame({
      game_id: gameId,
      start_time: startTime,
      secret_crash_point: crashPoint,
      status: "IN_PROGRESS",
    });
    console.log("start rounded")
    io.emit(SOCKET_EVENTS.ROUND_START, {
      roundId: 1,
      startTime: startTime,
      crashPoint,
    });
    const now = await getDateNow();
    console.log(startTime + ((crashPoint == 0 ? 0 : log(EXPONENTIAL_FACTOR, crashPoint)) * 1000) - now)
    setTimeout(async () => {
      const blockchainTxn = await endGameAptos('house_secret', 'salt', startTime + ((crashPoint == 0 ? 0 : log(EXPONENTIAL_FACTOR, crashPoint)) * 1000))
      console.log("blockchainTxn", blockchainTxn)
      if (blockchainTxn === null) {
        console.error("Error ending game")
        return
      }
      await endGame(gameId);
      console.log("end rounded")
      io.emit(SOCKET_EVENTS.ROUND_RESULT, { roundId: gameId, crashPoint });
      setTimeout(async () => {
        await cycleRounds();
      }, SUMMARY);
    }, startTime + ((crashPoint == 0 ? 0 : log(EXPONENTIAL_FACTOR, crashPoint)) * 1000) - now + 100);
  });
  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, async (message) => {
    await addChatMessage({
      authorEmail: message.authorEmail,
      message: message.message,
    });
    io.emit(SOCKET_EVENTS.CHAT_NOTIFICATION, message);
  });
});
async function cycleRounds() {
  try {
    await clearPlayerList();
    const now = await getDateNow();
    let blockchainTxn = await createNewGame('house_secret', 'salt')
    console.log("blockchainTxn", blockchainTxn)
    if (blockchainTxn === null) {
      console.error("Error creating new game")
      return
    }
    const crashPoint = calculateCrashPoint(blockchainTxn.randomNumber, 'house_secretsalt');
    const startTime = Math.floor(blockchainTxn.startTime / 1000);
    const gameId = Math.random().toString(36).substring(7);
    await createGame({
      game_id: gameId,
      start_time: startTime,
      secret_crash_point: crashPoint,
      status: "IN_PROGRESS",
    });
    console.log("start rounded")
    io.emit(SOCKET_EVENTS.ROUND_START, {
      roundId: gameId,
      startTime: startTime,
      crashPoint,
    });
    console.log(startTime + ((crashPoint == 0 ? 0 : log(EXPONENTIAL_FACTOR, crashPoint)) * 1000) - now)
    setTimeout(async () => {
      try {
        const blockchainTxn = await endGameAptos('house_secret', 'salt', startTime + ((crashPoint == 0 ? 0 : log(EXPONENTIAL_FACTOR, crashPoint)) * 1000))
        console.log("blockchainTxn", blockchainTxn)
        if (blockchainTxn === null) {
          console.error("Error ending game")
          return
        }
        await endGame(gameId);
        console.log("end rounded")
        io.emit(SOCKET_EVENTS.ROUND_RESULT, { roundId: gameId, crashPoint });
        setTimeout(async () => {
          await cycleRounds();
        }, SUMMARY);
      } catch (error) {
        console.error("Error ending game:", error);
        setTimeout(async () => {
          await cycleRounds();
        }, SUMMARY);
      }
    }, startTime + ((crashPoint == 0 ? 0 : log(EXPONENTIAL_FACTOR, crashPoint)) * 1000) - now + 100);
  } catch (error) {
    console.error("Error in cycleRounds:", error);
    setTimeout(async () => {
      await cycleRounds();
    }, SUMMARY);
  }
}
/**
 * 
 * @param base The base of the logarithm
 * @param value The value to take the logarithm of
 * 
 * @returns The logarithm of the value with the given base
 */
function log(base: number, value: number): number {
  console.log("log base:", base)
  console.log("log value:", value)
  console.log("log result:", Math.log(value) / Math.log(base))
  return Math.log(value) / Math.log(base);
}    
