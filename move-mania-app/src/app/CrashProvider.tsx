'use client';

import { User } from "@/lib/schema";
import { GameStatus } from "./controlCenter";
import { ReactNode, createContext, useEffect, useState, useCallback } from "react";
import { socket } from "@/lib/socket";
import { getSession } from "next-auth/react";
import { getCurrentGame, getUser, setUpAndGetUser } from "@/lib/api";
import { SOCKET_EVENTS } from "@/lib/types";
import { CashOutData } from "@/lib/types";
import { PlayerState } from "./playerList";
import { EXPONENTIAL_FACTOR, log } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

interface CrashPageProps {
  gameStatus: GameStatus | null;
  account: User | null;
  latestAction: number | null;
  playerList: PlayerState[];
  setPlayerList: React.Dispatch<React.SetStateAction<PlayerState[]>>;
}

export const gameStatusContext = createContext<CrashPageProps>({
  gameStatus: null,
  account: null,
  latestAction: null,
  playerList: [],
  setPlayerList: () => { },
});

export default function CrashProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [account, setAccount] = useState<User | null>(null);
  const [latestAction, setLatestAction] = useState<number | null>(null);
  const [showPWAInstall, setShowPWAInstall] = useState(false);
  const [playerList, setPlayerList] = useState<PlayerState[]>([]);

  const onConnect = useCallback(() => {
    console.log("socket connected");
    setIsConnected(true);
  }, []);

  const updatePlayerList = useCallback((newPlayerList: React.SetStateAction<PlayerState[]>) => {
    console.log("Updating playerList:", newPlayerList);
    setPlayerList(newPlayerList);
  }, []);

  const onDisconnect = useCallback(() => {
    setIsConnected(false);
  }, []);

  const onRoundStart = useCallback((data: any) => {
    setGameStatus({
      status: "COUNTDOWN",
      roundId: data.gameId,
      startTime: data.startTime,
      crashPoint: data.crashPoint,
    });
    setLatestAction(Date.now());
  }, []);

  const onRoundResult = useCallback((data: any) => {
    if (data && data.roundId && data.crashPoint) {
      setGameStatus({
        status: "END",
        roundId: data.gameId,
        startTime: data.startTime,
        crashPoint: data.crashPoint,
      });
      setLatestAction(Date.now());
    } else {
      console.error("Invalid data received in onRoundResult:", data);
    }
  }, [gameStatus]);

  const onBetConfirmed = useCallback(() => {
    setLatestAction(Date.now());
  }, []);

  const onCashOutConfirmed = useCallback((cashOutData: CashOutData) => {
    console.log("onCashOutConfirmed called with data:", cashOutData);
    console.log("Before updating playerList:", playerList);
    setLatestAction(Date.now());
    setPlayerList((prevList) => {
      const updatedList = prevList.map((player) =>
        player.username === cashOutData.playerEmail
          ? { ...player, cashOutMultiplier: cashOutData.cashOutMultiplier }
          : player
      );
      console.log("After updating playerList:", updatedList);
      return updatedList;
    });
    socket.emit(SOCKET_EVENTS.CASH_OUT_CONFIRMED, cashOutData);
    console.log("JUST EMITTED CASH OUT CONFIRMED:", cashOutData);
  }, []);

  useEffect(() => {
    console.log("CrashProvider updating game status:", gameStatus);
    getSession().then((session) => {
      if (session && session.user && session.user.email) {
        setUpAndGetUser({
          email: session.user.email,
          username: session.user.name || "",
          image: session.user.image || "",
          referred_by: null,
        }).then((user) => {
          if (user) {
            setAccount(user);
          }
        });
      }
    });

    const logAllEvents = (eventName: string, ...args: any[]) => {
      console.log(`Received ${eventName} event:`, ...args);
    };

    socket.onAny(logAllEvents);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(SOCKET_EVENTS.ROUND_START, onRoundStart);
    socket.on(SOCKET_EVENTS.BET_CONFIRMED, onBetConfirmed);
    socket.on(SOCKET_EVENTS.CASH_OUT_CONFIRMED, onCashOutConfirmed);
    socket.on(SOCKET_EVENTS.ROUND_RESULT, onRoundResult);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENTS.ROUND_START, onRoundStart);
      socket.off(SOCKET_EVENTS.BET_CONFIRMED, onBetConfirmed);
      socket.off(SOCKET_EVENTS.CASH_OUT_CONFIRMED, onCashOutConfirmed);
      socket.off(SOCKET_EVENTS.ROUND_RESULT, onRoundResult);
      socket.offAny(logAllEvents);
    };
  }, [onConnect, onDisconnect, onRoundStart, onBetConfirmed, onCashOutConfirmed, onRoundResult]);

  useEffect(() => {
    console.log("CrashProvider updating game status:", gameStatus);

    if (account && latestAction) {
      getUser(account.email).then((updatedUser) => {
        if (updatedUser) {
          const timeoutId = setTimeout(() => {
            getUser(account.email).then((updatedUser) => {
              if (updatedUser) {
                setAccount(updatedUser);
              }
            });
          }, 1000); // Delay API call by 1 second
          return () => clearTimeout(timeoutId);
        }
      });
    }
  }, [latestAction, account]);

  useEffect(() => {
    console.log("CrashProvider updating game status:", gameStatus);
    const fetchGameStatus = async () => {
      try {
        const game = await getCurrentGame();
        if (game == null) {
          setGameStatus(null);
        } else {
          const now = Date.now();
          const gameEndTime = game.start_time + (game.secret_crash_point == 0 ? 0 : log(EXPONENTIAL_FACTOR, game.secret_crash_point)) * 1000;

          if (game.start_time > now) {
            setGameStatus({
              status: "COUNTDOWN",
              roundId: game.game_id,
              startTime: game.start_time,
              crashPoint: game.secret_crash_point,
            });
          } else if (now < gameEndTime) {
            setGameStatus({
              status: "IN_PROGRESS",
              roundId: game.game_id,
              startTime: game.start_time,
              crashPoint: game.secret_crash_point,
            });
          } else {
            setGameStatus({
              status: "END",
              roundId: game.game_id,
              startTime: game.start_time,
              crashPoint: game.secret_crash_point,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching game status:", error);
      }
    };

    fetchGameStatus();
    const intervalId = setInterval(fetchGameStatus, 1000);

    return () => clearInterval(intervalId);
  }, []);

  function isInStandaloneMode() {
    return Boolean(
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || (window.navigator as any).standalone, // Fallback for iOS
    );
  }

  useEffect(() => {
    if (isInStandaloneMode()) {
      console.log('This is running as standalone.');
    } else {
      console.log('This is not running as standalone.');
      setShowPWAInstall(true);
    }
  }, []);


  return (
    <gameStatusContext.Provider
      value={{
        gameStatus,
        account,
        latestAction,
        playerList,
        setPlayerList: updatePlayerList,
      }}
    >
      {children}
      <AlertDialog open={showPWAInstall && localStorage.getItem("pwaPrompt") != 'true'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add to Phone Home Screen</AlertDialogTitle>
            <AlertDialogDescription>
              For the best experience, add this app to your home screen. <br /><br />
              In your browser&apos;s menu, tap the <b>share</b> icon and choose <b>Add to Home Screen</b> in the options.
              Then open the zion.bet app on your home screen to play.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowPWAInstall(false);
                localStorage.setItem("pwaPrompt", 'true');
              }}
              className="border border-red-700 px-6 py-1 text-red-500 bg-neutral-950 w-full focus:outline-none"
            >I&apos;ll stay in my browser</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </gameStatusContext.Provider>
  );
}