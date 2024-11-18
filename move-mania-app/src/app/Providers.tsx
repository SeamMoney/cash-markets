'use client';

import { SessionProvider } from 'next-auth/react';
import CrashProvider from './CrashProvider';
import { useEffect } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        console.log("Providers component mounted");
    }, []);

    return (
        <SessionProvider>
            <CrashProvider>
                {children}
            </CrashProvider>
        </SessionProvider>
    );
}