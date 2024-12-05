'use client';

import { updateUser } from "@/lib/api";
import { User } from "@/lib/schema";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { useContext, useState, useEffect } from "react";
import { gameStatusContext } from "../CrashProvider";

export default function AccountPage() {
  const { account } = useContext(gameStatusContext);
  const [privateKeyVisible, setPrivateKeyVisible] = useState(false);
  const [username, setUsername] = useState("");
  const [image, setImage] = useState("");

  useEffect(() => {
    if (account) {
      setUsername(account.username || "");
      setImage(account.image || "");
    }
  }, [account]);

  const onSubmit = async () => {
    if (!account) return;

    const updatedUser: User = {
      ...account,
      username: username || account.username,
      image: image || account.image,
    };

    await updateUser(account.email, updatedUser);

    window.location.reload();
  };

  if (!account) return <></>;

  return (
    <div className="px-2 pt-4">
      <div>
        <input type="text" autoFocus className="hidden" />
        <span className="text-lg">Edit profile</span>
        <p className="text-sm opacity-50">
          Make changes to your profile here.
        </p>
      </div>
      <div className="grid gap-4 py-4">
        <div className="border border-neutral-700 bg-neutral-800/20 bg-noise flex flex-row justify-between px-4 py-2">
          <label htmlFor="username" className="text-left">Username</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={account.username}
            className="bg-transparent border-none outline-none text-right text-ellipsis"
          />
        </div>
        <div className="border border-neutral-700 bg-neutral-800/20 bg-noise flex flex-row justify-between px-4 py-2">
          <label htmlFor="image" className="text-left">Profile Image URL</label>
          <input
            id="image"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder={account.image}
            className="bg-transparent border-none outline-none text-right text-ellipsis"
          />
        </div>
        <div className="border border-neutral-700 bg-neutral-800/20 bg-noise flex flex-row justify-between px-4 py-2">
          <label htmlFor="email" className="text-left">Email</label>
          <input
            id="email"
            disabled
            value={account.email}
            className="bg-transparent border-none outline-none text-right text-ellipsis cursor-not-allowed"
          />
        </div>
        <div className="border border-neutral-700 bg-neutral-800/20 bg-noise flex flex-row justify-between px-4 py-2">
          <label htmlFor="public_address" className="text-left">Public address</label>
          <input
            id="public_address"
            disabled
            value={account.public_address}
            className="bg-transparent border-none outline-none text-right text-ellipsis cursor-not-allowed"
          />
        </div>
        <div className="border border-neutral-700 bg-neutral-800/20 bg-noise flex flex-row justify-between px-4 py-2">
          <label htmlFor="private_key" className="font-light w-[100px]">Private key</label>
          <span className="opacity-50 flex flex-row justify-center items-center gap-1">
            <input
              id="private_key"
              type={privateKeyVisible ? "text" : "password"}
              disabled
              value={account.private_key}
              className="bg-transparent border-none outline-none text-right text-ellipsis w-[170px] cursor-not-allowed"
            />
            {!privateKeyVisible ? (
              <EyeIcon
                className="cursor-pointer"
                onClick={() => setPrivateKeyVisible(true)}
              />
            ) : (
              <EyeOffIcon
                className="cursor-pointer"
                onClick={() => setPrivateKeyVisible(false)}
              />
            )}
          </span>
        </div>
        <div className="border border-neutral-700 bg-neutral-800/20 bg-noise flex flex-row justify-between px-4 py-2">
          <label htmlFor="balance" className="text-left">Balance</label>
          <input
            id="balance"
            disabled
            value={account.balance}
            className="bg-transparent border-none outline-none text-right text-ellipsis cursor-not-allowed"
          />
        </div>
        <div className="border border-neutral-700 bg-neutral-800/20 bg-noise flex flex-row justify-between px-4 py-2">
          <label htmlFor="address" className="text-left">Address</label>
          <input
            id="address"
            disabled
            value={account.public_address}
            className="bg-transparent border-none outline-none text-right text-ellipsis cursor-not-allowed"
          />
        </div>
        <div className="border border-neutral-700 bg-neutral-800/20 bg-noise flex flex-row justify-between px-4 py-2">
          <label htmlFor="referral_code" className="text-left">Referral Code</label>
          <input
            id="referral_code"
            disabled
            value={account.referral_code}
            className="bg-transparent border-none outline-none text-right text-ellipsis cursor-not-allowed"
          />
        </div>
        <div className="border border-neutral-700 bg-neutral-800/20 bg-noise flex flex-row justify-between px-4 py-2">
          <label htmlFor="referred_by" className="text-left">Referred By</label>
          <input
            id="referred_by"
            disabled
            value={account.referred_by || "N/A"}
            className="bg-transparent border-none outline-none text-right text-ellipsis cursor-not-allowed"
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 w-full">
        <button
          type="submit"
          className="border border-neutral-700 hover:bg-neutral-800/80 hover:bg-noise px-6 py-1 text-neutral-500 w-full active:scale-95 active:opacity-50 transition-transform"
          onClick={() => signOut()}
        >
          Sign out
        </button>
        <button
          type="submit"
          className="border border-green-700 hover:bg-[#264234]/40 hover:bg-noise px-6 py-1 text-green-500 w-full active:scale-95 active:opacity-50 transition-transform"
          onClick={onSubmit}
        >
          Save changes
        </button>
      </div>
    </div>
  );
}