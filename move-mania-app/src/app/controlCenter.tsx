"use client";

import {
  getCurrentGame,
  getUserBalance,
  hasUserBet,
  hasUserCashOut,
  setUpAndGetUser,
} from "@/lib/api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { User } from "@/lib/schema";
import { cashOutBet, setNewBet } from "@/lib/socket";
import { SOCKET_EVENTS } from "@/lib/types";
import {
  EXPONENTIAL_FACTOR,
  calculateCurrentCrashPoint,
  cn,
  log,
} from "@/lib/utils";
import { useCallback, useContext, useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { gameStatusContext } from "./CrashProvider";
import { cashOut, placeBet } from "@/lib/aptos";
import { useToast } from "@/components/ui/use-toast";
import { setCashoutMultiplier } from "@/lib/cashOutStore";
import Link from "next/link";

export type GameStatus = {
  status: "COUNTDOWN" | "IN_PROGRESS" | "END";
  roundId: string;
  startTime: number;
  crashPoint: number;
};

export default function ControlCenter() {
  const { gameStatus, account, latestAction } = useContext(gameStatusContext);

  const { toast } = useToast();

  const [betAmount, setBetAmount] = useState("");
  const [autoCashout, setAutoCashout] = useState(false);
  const [autoCashoutAmount, setAutoCashoutAmount] = useState("");
  const [hasBet, setHasBet] = useState(false);
  const [hasCashOut, setHasCashOut] = useState(false);

  useEffect(() => {
    if (gameStatus?.status === 'END') {
      setHasBet(false);
      setHasCashOut(false);
    }
  }, [gameStatus?.status]);

  useEffect(() => {
    console.log("Game Status:", gameStatus);

    if (account && gameStatus?.status === "COUNTDOWN") {
      Promise.all([
        hasUserBet(account.email),
        hasUserCashOut(account.email),
      ]).then(([bet, cashout]) => {
        console.log("API Has Bet:", bet);
        console.log("API Has Cash Out:", cashout);
        setHasBet(bet);
        setHasCashOut(cashout);
      });
    } else if (gameStatus?.status === "COUNTDOWN") {
      setHasBet(false);
      setHasCashOut(false);
    }
  }, [gameStatus?.status, account]);

  console.log("ControlCenter rendering, gameStatus:", gameStatus);

  const onCashOut = useCallback(async () => {
    if (!socket || !account || !gameStatus?.startTime) {
      console.log("Missing required data for cash out:", {
        socket,
        account,
        gameStatus,
      });
      return;
    }

    const cashoutMultiplier = Number(
      calculateCurrentCrashPoint(
        (Date.now() - gameStatus.startTime) / 1000
      ).toFixed(2)
    );

    setCashoutMultiplier(cashoutMultiplier);

    toast({
      title: `Attempting to cash out at ${cashoutMultiplier}x...`,
    });

    try {
      console.log("Attempting to cash out with:", {
        privateKey: account.private_key.slice(0, 5) + "...",
        roundId: gameStatus.roundId,
        playerEmail: account.email,
        cashOutMultiplier: cashoutMultiplier,
        playerAddress: account.public_address,
      });

      const blockchainRes = await
        cashOut(account.private_key, {
          roundId: gameStatus.roundId,
          playerEmail: account.email,
          cashOutMultiplier: cashoutMultiplier,
          playerAddress: account.public_address,
        });

      setHasCashOut(true);
      console.log("Blockchain response:", blockchainRes);
      if (!blockchainRes) {
        throw new Error("Error cashing out on blockchain");
      }



      socket.emit('CASH_OUT', {
        roundId: gameStatus.roundId,
        playerEmail: account.email,
        cashOutMultiplier: cashoutMultiplier,
        playerAddress: account.public_address,
      });

      toast({
        title: `Cashed out at ${cashoutMultiplier}x`,
        description: (
          <Link
            href={`https://explorer.aptoslabs.com/txn/${blockchainRes.txnHash}/?network=testnet`}
            target="_blank"
            className="underline"
          >
            View transaction
          </Link>
        ),
      });
    } catch (error) {
      console.error("Error cashing out:", error);
      toast({
        title: "Error cashing out",
        description:
          "Please try again or contact support if the issue persists",
      });

      setHasCashOut(false);
    }
  }, [account, gameStatus, toast, socket]);

  const checkAutoCashout = useCallback(() => {
    if (!gameStatus || !gameStatus.startTime || !gameStatus.crashPoint) {
      console.log("Auto cashout check skipped: missing game status data");
      return;
    }

    const timeUntilCrash =
      gameStatus.startTime +
      log(EXPONENTIAL_FACTOR, gameStatus.crashPoint) * 1000 -
      Date.now();
    const timeUntilCashout =
      gameStatus.startTime +
      log(EXPONENTIAL_FACTOR, parseFloat(autoCashoutAmount) || 0) * 1000 -
      Date.now();

    console.log("Auto cashout check:", {
      hasBet,
      autoCashout,
      timeUntilCashout,
      timeUntilCrash,
      autoCashoutAmount,
    });

    if (
      hasBet &&
      autoCashout &&
      timeUntilCashout < timeUntilCrash &&
      timeUntilCashout > 0
    ) {
      console.log("Scheduling auto cashout");
      setTimeout(() => {
        console.log("Executing auto cashout");
        onCashOut();
      }, timeUntilCashout);
    }
  }, [gameStatus, autoCashout, autoCashoutAmount, hasBet, onCashOut]);

  useEffect(() => {
    if (gameStatus?.status === "IN_PROGRESS") {
      checkAutoCashout();
    }
  }, [gameStatus, checkAutoCashout]);

  const onSetBet = useCallback(async () => {
    if (!socket || !account || !gameStatus) return;

    toast({
      title: `Placing bet at ${betAmount} CASH...`,
    });

    try {
      const blockchainRes = await placeBet(account.private_key, {
        roundId: gameStatus.roundId,
        playerEmail: account.email,
        betAmount: parseFloat(betAmount),
        coinType: "CASH",
      });

      if (!blockchainRes) {
        throw new Error("Error placing bet");
      }

      await setNewBet({
        roundId: gameStatus.roundId,
        playerEmail: account.email,
        betAmount: parseFloat(betAmount),
        coinType: "CASH",
      });

      setHasBet(true);

      toast({
        title: `Bet placed at ${betAmount} CASH`,
        description: (
          <Link
            href={`https://explorer.aptoslabs.com/txn/${blockchainRes.txnHash}/?network=testnet`}
            target="_blank"
            className="underline"
          >
            View transaction
          </Link>
        ),
      });
    } catch (error) {
      console.error("Error placing bet:", error);
      toast({
        title: "Error placing bet",
        description: "Please try again",
      });
    }
  }, [account, gameStatus, betAmount, toast]);

  return (
    <div className="w-full h-full flex flex-col gap-4 items-start p-2">
      <div className=" flex flex-col items-start justify-around px-2 gap-2 w-full">
        <div className="flex flex-col gap-1 w-full">
          <div className="flex flex-row justify-between px-4 py-2 border border-neutral-700 bg-neutral-800/20 bg-noise w-full">
            <span className="font-light">BET</span>
            <span className="opacity-50 flex flex-row justify-center items-center gap-1">
              <input
                className="bg-transparent border-none outline-none text-right max-w-[40px]"
                value={betAmount}
                onChange={(e) => {
                  setBetAmount(e.target.value);
                }}
                placeholder="2.50"
                disabled={
                  !(
                    gameStatus?.startTime !== undefined &&
                    gameStatus.startTime > Date.now()
                  )
                }
              ></input>
              <span>CASH</span>
            </span>
          </div>
          <div className="flex flex-row items-center text-xs w-full">
            {[1, 5, 10, 25].map((amount) => (
              <div
                key={amount}
                className={`border px-2 py-1 cursor-pointer grow text-center ${parseFloat(betAmount) === amount
                  ? "border border-green-700 bg-[#264234]/60 bg-noise text-green-500"
                  : "opacity-50 border-neutral-700"
                  }`}
                onClick={() => setBetAmount(amount.toString())}
              >
                {amount} CASH
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-row items-baseline gap-2 w-full text-lg">
          {!account && (
            <button
              className="border border-green-700 px-6 py-1 text-green-500 bg-neutral-950 cursor-not-allowed w-full"
              disabled
            >
              Log in to play
            </button>
          )}
          {account && gameStatus?.status === "COUNTDOWN" && (
            <button
              className={cn(
                "border border-green-700 px-6 py-1 border-yellow-700 text-yellow-500 bg-neutral-950 w-full",
                hasBet
                  ? "bg-[#264234]/40 cursor-not-allowed border-green-700 text-green-500"
                  : "bg-[#404226]/40 active:scale-95 active:opacity-80 transition-transform"
              )}
              onClick={onSetBet}
              disabled={!(parseFloat(betAmount) > 0) || hasBet}
            >
              {hasBet
                ? "Bet placed"
                : parseFloat(betAmount) > 0
                  ? "Place bet"
                  : "Enter bet amount"}
            </button>
          )}
          {account &&
            gameStatus?.status === "IN_PROGRESS" &&
            hasBet &&
            !hasCashOut && (
              <button
                className="border border-green-700 px-6 py-1 text-green-500 bg-neutral-950 w-full hover:bg-[#404226]/40 hover:cursor-pointer bg-[#404226]/40 border-yellow-700 text-yellow-500 active:scale-95 active:opacity-80 transition-transform"
                onClick={onCashOut}
              >
                Cash out
              </button>
            )}
          {account && gameStatus?.status === "IN_PROGRESS" && hasCashOut && (
            <button
              className="border px-6 py-1 border-green-700 text-green-500 bg-[#264234]/40 cursor-not-allowed w-full"
              disabled
            >
              Cashed out
            </button>
          )}
          {account && gameStatus?.status === "IN_PROGRESS" && !hasBet && (
            <button
              className="border px-6 py-1 border-yellow-700 text-yellow-500 bg-neutral-950 cursor-not-allowed w-full"
              disabled
            >
              Game in progress
            </button>
          )}
          {
            account && gameStatus?.status === "END" && (
              <button
                className="border border-yellow-700 px-6 py-1 text-yellow-500 bg-neutral-950 cursor-not-allowed w-full"
                disabled
              >
                Game ended
              </button>
            )
          }
        </div>
      </div>

      <Accordion type="single" collapsible className="w-full px-2">
        <AccordionItem value="item-1">
          <AccordionTrigger className="opacity-50">
            Advanced mode
          </AccordionTrigger>
          <AccordionContent>
            <div className=" flex flex-col items-start justify-around pt-2 gap-2 w-full">
              <div className="flex flex-col gap-1 w-full">
                <div className="flex flex-row justify-between px-4 py-2 border border-neutral-700 bg-neutral-800/20 bg-noise">
                  <span className="font-light">AUTO CASHOUT @</span>
                  <span className="opacity-50 flex flex-row justify-center items-center gap-0">
                    <input
                      className="bg-transparent border-none outline-none text-right max-w-[40px]"
                      value={autoCashoutAmount}
                      onChange={(e) => {
                        setAutoCashout(false);
                        setAutoCashoutAmount(e.target.value);
                      }}
                      placeholder="2.50"
                    ></input>
                    <span>x</span>
                  </span>
                </div>
                <div className="flex flex-row items-center text-xs">
                  {[1.01, 1.5, 2, 5].map((amount) => (
                    <div
                      key={amount}
                      className={`text-center border px-2 py-1 cursor-pointer grow ${parseFloat(autoCashoutAmount) === amount
                        ? "border border-green-700 bg-[#264234]/60 bg-noise text-green-500"
                        : "opacity-50 border-neutral-700"
                        }`}
                      onClick={() => {
                        setAutoCashout(false);
                        setAutoCashoutAmount(amount.toString());
                      }}
                    >
                      {amount}x
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-row items-baseline gap-2 w-full text-lg">
                {!account && (
                  <button
                    className="border border-green-700 px-6 py-1 text-green-500 bg-neutral-950 cursor-not-allowed w-full"
                    disabled
                  >
                    Log in to set auto cash out
                  </button>
                )}
                {account && (
                  <button
                    className={cn(
                      "border px-6 py-1 bg-neutral-950 w-full",
                      autoCashout
                        ? "border-green-700 text-green-500"
                        : "border-neutral-700 text-neutral-500"
                    )}
                    onClick={() => setAutoCashout(!autoCashout)}
                  >
                    {autoCashout ? "Auto Cash Out On" : "Auto Cash Out Off"}
                  </button>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
