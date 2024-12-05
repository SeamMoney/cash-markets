'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getUser, setUpAndGetUser } from "@/lib/api";
import { User } from "@/lib/schema";
import { Ellipsis, Loader2Icon, Mail, Phone } from "lucide-react";
import { getSession, signIn, useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { COUNTRY_CODES } from "@/lib/countryCodes";
import { log } from "console";


export default function NavbarDropdown() {

  const searchParams = useSearchParams();
  const referredBy = searchParams.get("ref");

  const { data: session, status } = useSession();

  const [emailPhoneToggle, setEmailPhoneToggle] = useState<boolean>(false);
  const [phoneInput, setPhoneInput] = useState<string>("");
  const [emailInput, setEmailInput] = useState<string>("");

  const countryCodeRef = useRef<HTMLSelectElement>(null);

  if (status === "loading") {
    return (
      <button className="bg-white px-6 py-1 text-neutral-950 active:scale-95 active:opacity-50 transition-transform">
        <Loader2Icon className="animate-spin" />
      </button>
    )
  }

  return (
    <div className="flex flex-row items-center gap-2">
      {
        !session &&
        <button
          className="bg-white px-6 py-1 text-neutral-950 active:scale-95 active:opacity-50 transition-transform"
          onClick={() => signIn('google')}
        >
          Log in
        </button>
      }
      <DropdownMenu>
        <DropdownMenuTrigger><Ellipsis /></DropdownMenuTrigger>
        <DropdownMenuContent>
          <Link href='/'><DropdownMenuItem>Crash</DropdownMenuItem></Link>
          <Link href='/pool'><DropdownMenuItem>Pool</DropdownMenuItem></Link>
          <Link href='/account'><DropdownMenuItem>My account</DropdownMenuItem></Link>
          <DropdownMenuSeparator />
          <Link href="https://twitter.com/zionbets" target="_blank"><DropdownMenuItem>Twitter</DropdownMenuItem></Link>
          <Link href="https://t.me/zion_bets" target="_blank"><DropdownMenuItem>Telegram</DropdownMenuItem></Link>
          {session && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => signOut()}>Log out</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}