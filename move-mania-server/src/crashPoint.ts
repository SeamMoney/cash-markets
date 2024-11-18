import crypto from 'crypto';

/**
 * 
 * Calculate's the crash point based on the random number and salt based of the following criteria:
 * - There is a 3% chance of the crash point being 0 - meaning the game crashes immediately
 * - The crash point is calculated by taking the hash of the random number and salt and then converting it to a number
 * 
 * 
 * @param randomNumber The random number that is generated on-chain publically
 * @param salt The salt provided by the server to ensure the random number is not predictable
 */
export function calculateCrashPoint(randomNumber: string, salt: string) {
  console.log("Random Number: "+randomNumber)

  const hash = crypto.createHash("SHA3-256");
  // decodeURIComponent('616263'.replace(/\s+/g, '').replace(/[0-9a-f]{2}/g, '%$&'));

  console.log('randomNumber', randomNumber);
  console.log('salt', salt);
  const hashString = `${randomNumber}${salt}`;
  // console.log('hashString', hashString);
  const hm = hash.update(hashString);
  const h = hm.digest('hex');
  // console.log('hash', h);

  // console.log('h', h);
  // console.log('parseInt(h, 16)', parseInt(h, 16));
  // console.log('parseInt(h, 16) % 33', parseInt(h, 16) % 33);
  // console.log('BigInt(h) % BigInt(33)', BigInt('0x'+ h) % BigInt(33));
  if (BigInt('0x'+ h) % BigInt(33) == BigInt(0)) {
    return 0;
  }

  const n = BigInt('0x0' + h.slice(0, 13));
  // console.log('h.slice(0, 13)', h.slice(0, 13));
  // console.log('n', n);
  const e = BigInt(2) ** BigInt(52);
  // console.log('e', e);
  // console.log('Math.floor((100 * e - n) / (e - n)) / 100', Math.floor((100 * e - n) / (e - n)) / 100);
  return Number((Math.floor(Number((BigInt(100) * e - n)) / Number(e - n)) / 100));
}

// // Run through the calculateCrashPoint function with 1000 times and log the result
// for (let i = 0; i < 1000; i++) {
//   const randomNumber = Math.random();
//   const salt = Math.random().toString(36).substring(7);
//   console.log(calculateCrashPoint(randomNumber, salt));
// }

// // Run through the calculateCrashPoint function with 1000 times and log the result
// for (let i = 0; i < 100; i++) {
//   const randomNumber = i;
//   const salt = 'test';
//   console.log(calculateCrashPoint(randomNumber, salt), randomNumber, salt);
// }

// console.log(calculateCrashPoint('3199639427161852469', 'house_secretsalt'));
// console.log(calculateCrashPoint('3199639427161852469', '686f7573655f73656372657473616c74'));