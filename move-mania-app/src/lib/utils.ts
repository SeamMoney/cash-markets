import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const EXPONENTIAL_FACTOR = 1.06;

export function generateLineChartData(
  gameRoundId: string,
  crashPoint: number
): any[] {
  const exponentialBase = EXPONENTIAL_FACTOR;
  const tickMs = 100;
  const gameLengthMs = log(exponentialBase, crashPoint) * 1000;
  let currentElapsedTimeMs = 0;
  const dataPoints: any[] = [];
  let currentDate = new Date("2021-01-01T00:00:00Z");
  for (
    currentElapsedTimeMs;
    currentElapsedTimeMs < gameLengthMs;
    currentElapsedTimeMs += tickMs
  ) {
    const value = calculateCurrentCrashPoint(currentElapsedTimeMs / 1000);
    const timeString = currentDate.toISOString().split("T")[0];
    dataPoints.push({
      elapsedTime: currentElapsedTimeMs,
      dataPoint: { time: timeString, value },
    });
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }

  // Create a data point for the end of the game to show the crash point at the right time
  const value = crashPoint;
  const timeString = currentDate.toISOString().split("T")[0];
  dataPoints.push({
    elapsedTime: currentElapsedTimeMs,
    dataPoint: { time: timeString, value },
  });

  return dataPoints;
}
let roundId: string;
export function generateChartData(
  gameRoundId: string,
  crashPoint: number
): any[] {
  roundId =
    gameRoundId !== null && gameRoundId !== undefined ? gameRoundId : roundId;

  const startingPrice = 50;
  const exponentialBase = EXPONENTIAL_FACTOR;
  const tickMs = 100;
  const countdownMs = 20 * 1000;
  const gameLengthMs = log(exponentialBase, crashPoint) * 1000;
  const gameEndMs = 5 * 1000;
  const gameTicks = (countdownMs + gameLengthMs + gameEndMs) / tickMs;
  const hasher = crypto.createHash("sha256");
  if (hasher === undefined) {
    return [];
  }
  let gameRoundHash = hasher.update(roundId).digest("hex");
  while (gameRoundHash.length < gameTicks) {
    gameRoundHash += hasher.update(gameRoundHash).digest("hex");
  }

  let currentElapsedTimeMs = 0;
  const dataPoints: any[] = [];
  let currentDate = new Date("2021-01-01T00:00:00Z");

  /**
   * Start and fluctuate the stock chart for the countdown. Show the stock chart trading sideways
   * with small fluctuations, center around 50.
   *
   * A candle stick should be generated every tickMs.
   *
   * For each candlestick, the open value should be the close value of the previous candlestick.
   *
   * Calculate small random values for the high and low values.
   */
  for (
    currentElapsedTimeMs;
    currentElapsedTimeMs < countdownMs;
    currentElapsedTimeMs += tickMs
  ) {
    // console.log("currentElapsedTimeMs:", currentElapsedTimeMs);
    // console.log("currentElapsedTimeMs / tickMs:", currentElapsedTimeMs / tickMs);
    const sineValue = sin(currentElapsedTimeMs / 1000);
    const hexValue = parseInt(gameRoundHash[currentElapsedTimeMs / tickMs], 16);
    // console.log("sineValue:", sineValue);
    // console.log("hexValue:", hexValue);
    const candleStickValue = sineValue * hexValue;
    // console.log("candleStickValue:", candleStickValue);

    const open: number =
      currentElapsedTimeMs === 0
        ? startingPrice
        : dataPoints[currentElapsedTimeMs / tickMs - 1].dataPoint.close;
    const close = open + candleStickValue;
    const high = close + Math.random() * 5 * sineValue;
    const low = open - Math.random() * 5 * sineValue;
    const timeString = currentDate.toISOString().split("T")[0];
    dataPoints.push({
      elapsedTime: currentElapsedTimeMs,
      dataPoint: { time: timeString, open, high, low, close },
    });
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    // console.log("dataPoints[currentElapsedTimeMs / tickMs]:", dataPoints[currentElapsedTimeMs / tickMs]);
  }

  // console.log("dataPoints:", dataPoints)
  // console.log("currentElapsedTimeMs:", currentElapsedTimeMs)
  // console.log("gameLengthMs:", gameLengthMs)
  for (
    currentElapsedTimeMs;
    currentElapsedTimeMs < gameLengthMs + countdownMs;
    currentElapsedTimeMs += tickMs
  ) {
    const hexValue = parseInt(gameRoundHash[currentElapsedTimeMs / tickMs], 16);
    const currentCrashPoint =
      calculateCurrentCrashPoint(
        currentElapsedTimeMs / 1000 - countdownMs / 1000
      ) * 5;
    const sineValue = 0.3 * sin(currentElapsedTimeMs / 1000) + 0.08;
    // console.log("hexValue:", hexValue);
    // console.log("currentCrashPoint:", currentCrashPoint);
    // console.log("sineValue:", sineValue);
    const candleStickValue = sineValue * hexValue * currentCrashPoint * 5;
    // console.log("candleStickValue:", candleStickValue);

    const open: number =
      currentElapsedTimeMs === 0
        ? startingPrice
        : dataPoints[currentElapsedTimeMs / tickMs - 1].dataPoint.close;
    const close = open + candleStickValue;
    const high = close + Math.random() * 5 * sineValue * currentCrashPoint * 5;
    const low = open - Math.random() * 5 * sineValue * currentCrashPoint * 5;
    const timeString = currentDate.toISOString().split("T")[0];
    dataPoints.push({
      elapsedTime: currentElapsedTimeMs,
      dataPoint: { time: timeString, open, high, low, close },
    });
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }

  // for (currentElapsedTimeMs; currentElapsedTimeMs < gameEndMs + gameLengthMs + countdownMs ; currentElapsedTimeMs += tickMs) {
  const open: number =
    currentElapsedTimeMs === 0
      ? startingPrice
      : dataPoints[currentElapsedTimeMs / tickMs - 1].dataPoint.close;
  const close = 0;
  const high = open;
  const low = 0;
  const timeString = currentDate.toISOString().split("T")[0];
  dataPoints.push({
    elapsedTime: currentElapsedTimeMs,
    dataPoint: { time: timeString, open, high, low, close },
  });
  currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  // }

  // console.log("dataPoints:", dataPoints)
  // console.log("equal lengths", gameTicks === dataPoints.length)

  return dataPoints;
}

/**
 *
 * @param base The base of the logarithm
 * @param value The value to take the logarithm of
 *
 * @returns The logarithm of the value with the given base
 */
export function log(base: number, value: number): number {
  // console.log("log base:", base)
  // console.log("log value:", value)
  // console.log('result', Math.log(value) / Math.log(base))
  return Math.log(value) / Math.log(base);
}

/**
 *
 * @param x The value to take the sine of
 *
 * @returns The sine of the value
 */
function sin(x: number): number {
  return Math.sin(x * 5);
}

export function calculateCurrentCrashPoint(seconds_elapsed: number): number {
  return EXPONENTIAL_FACTOR ** seconds_elapsed;
}
