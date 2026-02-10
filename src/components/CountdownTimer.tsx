'use client';

import { useState, useEffect } from 'react';

// Challenge ends at midnight on Feb 28, 2026 SAST (UTC+2)
// That's Feb 27, 2026 22:00:00 UTC
const END_DATE = new Date('2026-02-28T00:00:00+02:00');

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = END_DATE.getTime() - now.getTime();

      if (difference <= 0) {
        setIsEnded(true);
        return null;
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (isEnded) {
    return (
      <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-xl px-4 py-3 text-white text-center">
        <p className="text-sm font-medium">Challenge Complete!</p>
      </div>
    );
  }

  if (!timeLeft) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl px-4 py-3 border border-slate-600">
      <p className="text-xs text-slate-400 mb-1 text-center">Challenge ends in</p>
      <div className="flex gap-2 justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{timeLeft.days}</p>
          <p className="text-xs text-slate-400">days</p>
        </div>
        <span className="text-2xl font-bold text-slate-500">:</span>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</p>
          <p className="text-xs text-slate-400">hrs</p>
        </div>
        <span className="text-2xl font-bold text-slate-500">:</span>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</p>
          <p className="text-xs text-slate-400">min</p>
        </div>
        <span className="text-2xl font-bold text-slate-500">:</span>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{String(timeLeft.seconds).padStart(2, '0')}</p>
          <p className="text-xs text-slate-400">sec</p>
        </div>
      </div>
    </div>
  );
}
