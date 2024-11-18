"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { User } from "@/lib/schema";
import { Clipboard, Loader2Icon } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link";
import { getBalance, transferApt } from "@/lib/aptos";
import { cn } from "@/lib/utils";
import { gameStatusContext } from "./CrashProvider";

export default function BalanceButton() {
  const { toast } = useToast()
  const { account } = useContext(gameStatusContext);
  const [balance, setBalance] = useState<number | null>(null);
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (account) {
      getBalance(account.public_address, `${process.env.MODULE_ADDRESS}::cash::CASH`).then((balance) => {
        setBalance(balance);
      });
    }
  }, [account]);

  useEffect(() => {
    if (account) {
      const interval = setInterval(() => {
        getBalance(account.public_address, `${process.env.MODULE_ADDRESS}::cash::CASH`).then((balance) => {
          setBalance(balance);
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [account]);

  const onWithdraw = async () => {
    if (!account || !balance || transferAmount === '') return;
    if (parseFloat(transferAmount) <= 0) {
      toast({
        title: "Please enter a valid amount",
      });
      return;
    }
    if (parseFloat(transferAmount) > balance) {
      toast({
        title: "Insufficient funds",
      });
      return;
    }
    if (recipientAddress === '') {
      toast({
        title: "Please enter a recipient address",
      });
      return;
    }

    setLoading(true);

    try {
      const tx = await transferApt(
        account.private_key,
        parseFloat(transferAmount),
        recipientAddress,
        `${process.env.MODULE_ADDRESS}::cash::CASH`
      );

      if (!tx) {
        throw new Error("Transaction failed");
      }

      toast({
        title: "Funds withdrawn",
        description: <Link href={`https://explorer.aptoslabs.com/txn/${tx.txnHash}/?network=testnet`} target="_blank" className="underline">View transaction</Link>
      });


      setRecipientAddress('');
      setTransferAmount('');
    } catch (error) {
      console.error("Withdrawal error:", error);
      toast({
        title: "Failed to withdraw funds",
        description: "Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!account) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-xs text-white font-semibold">
          {balance?.toFixed(2) || '0.00'} CASH
        </button>
      </DialogTrigger>
      <DialogContent className="bg-neutral-950">
        <input type="text" autoFocus className="hidden" />
        <DialogTitle>Your balance: <span className="font-normal">{balance?.toFixed(2) || '0.00'} CASH</span></DialogTitle>
        <DialogTitle>Deposit Funds</DialogTitle>
        <DialogDescription>
          Send CASH to the public address below to deposit funds into your account.
        </DialogDescription>
        <div className="border border-neutral-700 bg-neutral-800/20 bg-noise flex flex-row justify-between px-4 py-2">
          <label
            htmlFor="public_address"
            className="text-left"
          >
            Public address
          </label>
          <span className="opacity-50 flex flex-row justify-center items-center gap-1">
            <input
              id="public_address"
              disabled
              value={account.public_address}
              className="bg-transparent border-none outline-none text-right text-ellipsis cursor-not-allowed"
            />
            <Clipboard className="w-4 h-4 cursor-pointer opacity-80 hover:opacity-100" onClick={() => {
              navigator.clipboard.writeText(account.public_address);
              toast({
                title: "Address copied to clipboard",
              });
            }} />
          </span>
        </div>
        <DialogTitle>Withdraw Funds</DialogTitle>
        <DialogDescription>
          Withdraw CASH from your account to the address specified below.
        </DialogDescription>
        <div className="flex flex-col w-full items-end w-full gap-2">
          <div className="border border-neutral-700 bg-neutral-800/20 bg-noise flex flex-row justify-between px-4 py-2 w-full">
            <label
              htmlFor="withdraw_amount"
              className="text-left"
            >
              Amount
            </label>
            <span className="opacity-50 flex flex-row justify-center items-center gap-1">
              <input
                id="withdraw_amount"
                placeholder={`${balance?.toFixed(2) || '0.00'}`}
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="bg-transparent border-none outline-none text-right text-ellipsis"
              />
              <span>CASH</span>
            </span>
          </div>
          <div className="border border-neutral-700 bg-neutral-800/20 bg-noise flex flex-row justify-between px-4 py-2 w-full">
            <label
              htmlFor="recipient_address"
              className="text-left"
            >
              Recipient address
            </label>
            <span className="opacity-50 flex flex-row justify-center items-center gap-1">
              <input
                id="recipient_address"
                placeholder={account.public_address}
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="bg-transparent border-none outline-none text-right text-ellipsis"
              />
            </span>
          </div>
          <button
            onClick={onWithdraw}
            disabled={loading}
            className={cn(
              "border border-yellow-700 px-6 py-1 text-yellow-500 bg-neutral-950",
              parseFloat(transferAmount) > 0 && balance && parseFloat(transferAmount) <= balance && recipientAddress !== '' && 'bg-[#404226]/40  active:scale-95 active:opacity-80 transition-transform',
              loading && 'scale-95 opacity-80 cursor-not-allowed'
            )}
          >
            {loading ? <Loader2Icon className="animate-spin" /> : 'Withdraw'}
          </button>
        </div>
        <DialogTitle>Aptos on-ramp (COMING SOON)</DialogTitle>
        <DialogDescription>
          Purchase CASH with your credit card and deposit it into your account.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}