import http from "http";

import { Server } from "socket.io";
import { ChatMessage, SOCKET_EVENTS } from "./types";
import { addBetToPlayerList, addCashOutToPlayerList, addChatMessage, clearPlayerList, createGame, endGame, getUser } from "./database";

const COUNTDOWN = 20 * 1000; 
const SUMMARY = 5 * 1000; 

const httpServer = http.createServer();

const PORT = 8080,
  HOST = "localhost";

const io = new Server(httpServer, {
  cors: {
    origin: "*", // or a list of origins you want to allow, e.g. ["http://localhost:3000"]
    credentials: true,
  },
});

httpServer.listen(PORT, HOST, () => {
  console.log("Server running on port:", PORT);
});

io.on("connection", (socket) => {
  console.log(socket.id);
  socket.on(SOCKET_EVENTS.SET_BET, async (betData) => {
    console.log(`Received bet: ${JSON.stringify(betData)}`);
    await addBetToPlayerList(betData);
    io.emit(SOCKET_EVENTS.BET_CONFIRMED, betData);
  })
  
  socket.on(SOCKET_EVENTS.CASH_OUT, async (cashOutData) => {
    console.log(`Received cash out: ${JSON.stringify(cashOutData)}`);
    await addCashOutToPlayerList(cashOutData);
    io.emit(SOCKET_EVENTS.CASH_OUT_CONFIRMED, cashOutData);
  })

  socket.on(SOCKET_EVENTS.START_ROUND, async () => {
    await clearPlayerList();
    console.log('Starting round');
    let crashPoint = (Math.random() * 10);
    if (crashPoint < 1) {
      crashPoint = 0;
    }
    console.log(`Round crashed at ${crashPoint}`);
    const startTime = Date.now() + COUNTDOWN;
    const gameId = Math.random().toString(36).substring(7);
    await createGame({
      game_id: gameId,
      start_time: startTime,
      secret_crash_point: crashPoint,
      status: "IN_PROGRESS"
    })
    io.emit(SOCKET_EVENTS.ROUND_START, { roundId: 1, startTime: Date.now() + COUNTDOWN, crashPoint });

    setTimeout(async () => {
      await endGame(gameId);
      io.emit(SOCKET_EVENTS.ROUND_RESULT, { roundId: 1, crashPoint });
      setTimeout(async () => {
        await cycleRounds();
      }, SUMMARY);
    }, COUNTDOWN + crashPoint * 1000);
  })

  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, async (message) => {
    console.log(`Received chat message: ${JSON.stringify(message)}`);
    await addChatMessage({
      authorEmail: message.authorEmail,
      message: message.message,
    });
    io.emit(SOCKET_EVENTS.CHAT_NOTIFICATION, message);
  })
});

async function cycleRounds() {
  await clearPlayerList();
  console.log('cycling rounds');
  let crashPoint = (Math.random() * 10);
  if (crashPoint < 1) {
    crashPoint = 0;
  }
  console.log(`Round crashed at ${crashPoint}`);
  const startTime = Date.now() + COUNTDOWN;
  const gameId = Math.random().toString(36).substring(7);
  await createGame({
    game_id: gameId,
    start_time: startTime,
    secret_crash_point: crashPoint,
    status: "IN_PROGRESS"
  })
  io.emit(SOCKET_EVENTS.ROUND_START, { roundId: 1, startTime: Date.now() + COUNTDOWN, crashPoint });

  setTimeout(async () => {
    await endGame(gameId);
    io.emit(SOCKET_EVENTS.ROUND_RESULT, { roundId: 1, crashPoint });
    setTimeout(async () => {
      await cycleRounds();
    }, SUMMARY);
  }, COUNTDOWN + crashPoint * 1000);
}




