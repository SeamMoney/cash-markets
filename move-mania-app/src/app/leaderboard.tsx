"use client";

import { getCurrentGame, getPlayerList, getUsers } from "@/lib/api";
import { BetData, CashOutData, RoundStart, SOCKET_EVENTS } from "@/lib/types";
import { useContext, useEffect, useState } from "react";
import { Socket, io } from "socket.io-client";
import { GameStatus } from "./controlCenter";
import { cn } from "@/lib/utils";

import { socket } from "@/lib/socket";
import { gameStatusContext } from "./CrashProvider";
import { getBalance } from "@/lib/aptos";
import { InfoIcon } from "lucide-react";
import Link from "next/link";

export type PlayerState = {
    username: string;
    public_address: string;
    cash_balance: number;
};

export default function Leaderboard() {
    const {
        account,
        gameStatus,
        latestAction
    } = useContext(gameStatusContext);
    // const [updateList, setUpdateList] = useState(true);
    const [users, setUsers] = useState<PlayerState[]>([]);

    useEffect(() => {
        getUsers().then((users) => {
            console.log("got users", users)
            // getBalances(users).then((balances) => {
            //     console.log(balances)
            //     setUsers(balances);
            //     console.log("Updated leaderboard")
            // });
        });
    }, [account]);

    const getBalances = async (users: { username: string, public_address: string, private_key: string }[]) => {
        const balances = await Promise.all(
            users.map(async (user) => {
                try {
                    const balance = await getBalance(user.private_key, `${process.env.MODULE_ADDRESS}::cash::CASH`);
                    return {
                        username: user.username,
                        public_address: user.public_address,
                        cash_balance: balance,
                    };
                } catch (e) {
                    console.error(e);
                    return {
                        username: user.username,
                        public_address: user.public_address,
                        cash_balance: 0,
                    };
                }
            })
        );
        return balances;
    }

    console.log("Leaderboard rendering, users:", users);

    return (
        <div className="border border-neutral-700 h-full flex flex-col items-left gap-2 w-full min-h-[200px] max-h-[700px]">
            <span className="font-semibold text-lg pt-1 ps-4 flex flex-row items-center"><span>CASH Leaderboard</span><Link href='https://x.com/zionbets/status/1770459737076953351?s=20' target="_blank"><InfoIcon className="h-4 opacity-50 hover:opacity-100 hover:cursor-pointer" /></Link></span>
            <table className="w-full scroll">
                <thead className="">
                    <tr className="border-b border-neutral-800 text-neutral-400">
                        <th className="w-[50px] text-center ps-4">Place</th>
                        <th className="w-[200px] text-left ps-4">Username</th>
                        <th className="w-[100px] text-right pr-4">
                            Balance{" "}
                            <span className="text-neutral-500  text-xs">cash</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {users
                        .sort((a, b) => {
                            return b.cash_balance - a.cash_balance;
                        })
                        .slice(0, 10)
                        .map((player, index) => (
                            <tr key={index} className="text-white text-sm  h-8">
                                <td className="w-[50px] text-center ps-4 bg-neutral-800/40 bg-[#264234]/40 border-b border-neutral-800">
                                    {index + 1}
                                </td>
                                <td className="ps-4 w-[200px] text-left ps-4 bg-neutral-800/40 bg-[#264234]/40 border-b border-neutral-800">{player.username}</td>
                                <td className="text-right pr-4 w-[100px] text-right pr-4  bg-neutral-800/40 bg-[#264234]/40 border-b border-neutral-800">
                                    {player.cash_balance.toLocaleString(undefined, {
                                        maximumFractionDigits: 2,
                                        minimumFractionDigits: 2,
                                    })}
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );
}
