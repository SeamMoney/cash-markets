"use client";

import { getCurrentGame, getPlayerList } from "@/lib/api";
import { BetData, CashOutData, RoundStart, SOCKET_EVENTS } from "@/lib/types";
import { useContext, useEffect, useState } from "react";
import { Socket, io } from "socket.io-client";
import { GameStatus } from "./controlCenter";
import { cn } from "@/lib/utils";

import { socket } from "@/lib/socket";
import { getCashoutMultiplier } from "@/lib/cashOutStore";
import { gameStatusContext } from "./CrashProvider";

export type PlayerState = {
  username: string;
  betAmount: number;
  coinType: string;
  cashOutMultiplier: number; //not done with this line number||null
};

export default function PlayerList() {
  const { gameStatus, latestAction } = useContext(gameStatusContext);
  const [players, setPlayers] = useState<PlayerState[]>([]);

  useEffect(() => {
    const fetchPlayers = async () => {
      const fetchedPlayers = await getPlayerList();
      setPlayers(fetchedPlayers);
      console.log("player list:", fetchedPlayers);
    };

    fetchPlayers();

    const handleCashOut = (data: CashOutData) => {
      console.log("Cash out data:", data);
      setPlayers((prevPlayers) =>
        prevPlayers.map((player) =>
          player.username === data.playerEmail
            ? { ...player, cashOutMultiplier: data.cashOutMultiplier }
            : player
        )
      );
    };

    socket.on(SOCKET_EVENTS.CASH_OUT_CONFIRMED, handleCashOut);

    return () => {
      socket.off(SOCKET_EVENTS.CASH_OUT_CONFIRMED, handleCashOut);
    };
  }, [latestAction]);

  return (
    <div className="border border-neutral-700 h-full flex flex-col items-left gap-2 w-full min-h-[200px] max-h-[700px]">
      <span className="font-semibold text-lg pt-1 ps-4">Live Bets</span>
      <table className="w-full scroll">
        <thead className="">
          <tr className="border-b border-neutral-800 text-neutral-400">
            <th className="w-[200px] text-left ps-4">Username</th>
            <th className="w-[100px] text-center">
              Multiplier <span className="text-neutral-500  text-xs">x</span>
            </th>
            <th className="w-[100px] text-right pr-4">
              Bet <span className="text-neutral-500  text-xs">cash</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {players
            .sort((a, b) => {
              if (gameStatus?.status == "COUNTDOWN") {
                return b.betAmount - a.betAmount;
              } else {
                if (a.cashOutMultiplier && b.cashOutMultiplier) {
                  return b.cashOutMultiplier - a.cashOutMultiplier;
                } else if (a.cashOutMultiplier) {
                  return 1;
                } else if (b.cashOutMultiplier) {
                  return -1;
                } else {
                  return b.betAmount - a.betAmount;
                }
              }
            })
            .map((player, index) => (
              <tr key={index} className="text-white text-sm  h-8">
                {gameStatus?.status == "IN_PROGRESS" ? ( // IF the game has ended
                  player.cashOutMultiplier ? (
                    <td className="w-[200px] text-left ps-4 text-green-500 bg-[#264234]/40 border-b border-neutral-800">
                      {player.username}
                    </td>
                  ) : (
                    <td className="w-[200px] text-left ps-4 text-red-500 bg-[#3F221E]/40 border-b border-neutral-800">
                      {player.username}
                    </td>
                  )
                ) : player.cashOutMultiplier ? (
                  <td className="w-[200px] text-left ps-4 text-green-500 bg-[#264234]/40 border-b border-neutral-800">
                    {player.username}
                  </td>
                ) : (
                  <td className="w-[200px] text-left ps-4 bg-neutral-800/40 bg-[#264234]/40 border-b border-neutral-800">
                    {player.username}
                  </td>
                )}
                {gameStatus?.status == "IN_PROGRESS" ? (
                  player.cashOutMultiplier ? (
                    <td
                      className={cn(
                        "w-[100px] text-center text-green-500 bg-[#264234]/40 border-b border-neutral-800"
                      )}
                    >
                      {player.cashOutMultiplier.toFixed(2)}
                    </td>
                  ) : (
                    <td className="w-[100px] text-center text-red-500 bg-[#3F221E]/40 border-b border-neutral-800">
                      0.00
                    </td>
                  )
                ) : player.cashOutMultiplier ? (
                  <td
                    className={cn(
                      "w-[100px] text-center text-green-500 bg-[#264234]/40 border-b border-neutral-800"
                    )}
                  >
                    {player.cashOutMultiplier.toFixed(2)}
                  </td>
                ) : (
                  <td className="w-[100px] text-center bg-neutral-800/40 bg-[#264234]/40 border-b border-neutral-800">
                    --
                  </td>
                )}
                {gameStatus?.status == "IN_PROGRESS" ? ( // IF the game has ended
                  player.cashOutMultiplier ? (
                    <td className="w-[100px] text-right pr-4  text-green-500 bg-[#264234]/40 border-b border-neutral-800">
                      +
                      {(player.betAmount * player.cashOutMultiplier).toFixed(2)}
                    </td>
                  ) : (
                    <td className="w-[100px] text-right pr-4  text-red-500 bg-[#3F221E]/40 border-b border-neutral-800">
                      -{player.betAmount.toFixed(2)}
                    </td>
                  )
                ) : player.cashOutMultiplier ? (
                  <td className="w-[100px] text-right pr-4  text-green-500 bg-[#264234]/40 border-b border-neutral-800">
                    +{(player.betAmount * player.cashOutMultiplier).toFixed(2)}
                  </td>
                ) : (
                  <td className="w-[100px] text-right pr-4  bg-neutral-800/40 bg-[#264234]/40 border-b border-neutral-800">
                    -{player.betAmount.toFixed(2)}
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}