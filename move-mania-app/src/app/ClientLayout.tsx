'use client';

import ChatWindow from "./chatWindow";
import Link from "next/link";
import BalanceButton from "./balanceButton";
import { Toaster } from "@/components/ui/toaster";
import NavbarDropdown from "./navbarDropdown";
import { Suspense } from "react";
import Image from "next/image";
import logo from "@/../public/$CASH.svg";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-full min-h-screen overflow-hidden">
            <nav className="fixed w-full h-12 z-30 px-2 border-b border-neutral-700 bg-[#020202] bg-noise">
                <div className="flex flex-row items-center justify-between w-full h-full">
                    <div className="flex flex-row items-center gap-4">
                        <div className="flex flex-row items-center justify-start">
                            <Link href='/'><Image src={logo} className="" alt="" width={100} height={100} /></Link>
                        </div>
                    </div>
                    <div className="flex flex-row gap-4 items-center">
                        <BalanceButton />
                        <Suspense>
                            <NavbarDropdown />
                        </Suspense>
                    </div>
                </div>
            </nav>
            <div className="flex flex-col pt-12 w-full items-center">
                <main className="overflow-y-auto max-w-5xl">
                    {children}
                    <Toaster />
                </main>
            </div>
            <aside className="fixed bottom-4 right-4">
                <ChatWindow />
            </aside>
        </div>
    );
}