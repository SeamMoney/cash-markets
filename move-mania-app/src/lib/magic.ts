import { AptosExtension } from '@magic-ext/aptos';
import { Magic } from 'magic-sdk'
import { RPC_URL } from './aptos';

const createMagic = () => {
  return typeof window !== "undefined" && new Magic(
    'pk_live_A097CA542D008F6E', 
    {
      extensions: [
        new AptosExtension({
          nodeUrl: RPC_URL
        }),
      ],
    }
  );
}
export const magic = createMagic();

export const magicLogin = async (phoneNumber: string) => {

  if (!magic) {
    console.error('Magic not yet initialized');
    return;
  }

  // await magic.wallet.connectWithUI();
  console.log('magic', magic)
  console.log('context login')
  try {
    console.log('logging in')
     const did = await magic.auth.loginWithSMS({
       phoneNumber: phoneNumber,
     });
     console.log(`DID Token: ${did}`);

     return did;
  } catch(e) {
    console.log('Error logging in', e);
    return null;
  }
}

export const magicLogout = async () => {
  const errorMessage  = "Error creating magic instance while trying to log out"
  if (magic === false) {
      throw new Error(errorMessage)
  }
  try {
      await magic.user.logout()
  } catch (error) {
      throw new Error(error as string)
  }
}