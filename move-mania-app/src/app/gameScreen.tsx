"use client";

import { useContext, useEffect, useState } from "react";
import { GameStatus } from "./controlCenter";
import { SOCKET_EVENTS, RoundStart } from "@/lib/types";
import { Socket, io } from "socket.io-client";
import CountUp from "react-countup";
import { getCurrentGame } from "@/lib/api";
import { startRound } from "@/lib/socket";

import { socket } from "@/lib/socket";

import { gameStatusContext } from "./CrashProvider";
import CandlestickChart from "@/components/CandlestickChart.client";
import { calculateCurrentCrashPoint, generateChartData, generateLineChartData } from "@/lib/utils";

export default function GameScreen() {
  const {
    gameStatus,
  } = useContext(gameStatusContext);

  const onStartRound = () => {
    if (!socket) return;

    const success = startRound();
  };

  const [currentMultiplier, setCurrentMultiplier] = useState(1);

  useEffect(() => {
    if (gameStatus?.status === "IN_PROGRESS") {
      const interval = setInterval(() => {
        const elapsedTime = (Date.now() - gameStatus.startTime!) / 1000;
        const multiplier = calculateCurrentCrashPoint(elapsedTime);
        setCurrentMultiplier(multiplier);
      }, 10);

      return () => clearInterval(interval);
    }
  }, [gameStatus]);

  console.log("GameScreen rendering, gameStatus:", gameStatus);

  if (gameStatus === null) {
    return (
      <div className=" h-full w-full bg-neutral-950">
        <span onClick={onStartRound}>No games yet - click here to admin start one</span>
      </div>
    );
  } else if (gameStatus.status === "COUNTDOWN") {
    return (
      <div className=" w-full -mt-10">
        <CountUp
          className="relative z-10 top-12 left-5 text-green-500 text-4xl"
          start={(gameStatus.startTime! - Date.now()) / 1000}
          end={0}
          duration={(gameStatus.startTime! - Date.now()) / 1000}
          separator=" "
          decimals={0}
          decimal="."
          prefix="Next round in  "
          suffix=" s"
          useEasing={false}
        />
        <CandlestickChart startTime={gameStatus.startTime!} crashPoint={gameStatus.crashPoint} data={generateChartData(gameStatus.roundId, gameStatus.crashPoint)} linedata={generateLineChartData(gameStatus.roundId, gameStatus.crashPoint)} />
      </div>
    );
  } else if (gameStatus.status === "IN_PROGRESS") {
    return (
      <div className=" w-full -mt-10">
        <div>
          <span className="relative z-10 top-12 left-5 text-green-500 text-4xl tracking-base">{currentMultiplier.toFixed(2)}x</span>
          {/* <CountUp
            className="relative z-10 top-12 left-5 text-green-500 text-xl"
            start={(Date.now() - gameStatus.startTime!) / 1000 + 1}
            end={gameStatus.crashPoint!}
            duration={gameStatus.crashPoint! - ((Date.now() - gameStatus.startTime!) / 1000 + 1)}
            separator=""
            decimals={2}
            decimal="."
            prefix="Your portfolio is up: "
            suffix="x"
            useEasing={false}
            // easingFn={(t: number, b: number, c: number, d: number) => {
            //   console.log(t, b, c, d)
            //   return (t==0) ? b : c * Math.pow(1.06, 10 * (t/d - 1)) + b;
            // }}
          /> */}
          <CandlestickChart startTime={gameStatus.startTime!} crashPoint={gameStatus.crashPoint} data={generateChartData(gameStatus.roundId, gameStatus.crashPoint)} linedata={generateLineChartData(gameStatus.roundId, gameStatus.crashPoint)} />
        </div>
      </div>
    );
  } else if (gameStatus.status === "END") {
    return (
      <div className=" w-full -mt-10">
        <div>
          <CountUp
            className="relative z-10 top-12 left-5 text-green-500 text-4xl"
            start={gameStatus.crashPoint!}
            end={gameStatus.crashPoint!}
            duration={0}
            separator=""
            decimals={2}
            decimal="."
            prefix="Crashed at "
            suffix="x"
            useEasing={false}
          />
          {gameStatus.startTime && gameStatus.crashPoint && (
            <CandlestickChart
              startTime={gameStatus.startTime}
              crashPoint={gameStatus.crashPoint}
              data={generateChartData(gameStatus.roundId, gameStatus.crashPoint)}
              linedata={generateLineChartData(gameStatus.roundId, gameStatus.crashPoint)}
            />
          )}
        </div>
      </div>
    );
  }
}