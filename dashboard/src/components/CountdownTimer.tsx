'use client';
import React, { useState, useEffect } from 'react';

export default function CountdownTimer({ endDateStr }: { endDateStr: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    // format is "04-08-2026, 21:59"
    const match = endDateStr.match(/(\d{2})-(\d{2})-(\d{4}),\s*(\d{2}):(\d{2})/);
    if (!match) return;
    
    const [_, d, m, y, h, min] = match;
    const target = new Date(`${y}-${m}-${d}T${h}:${min}:00`).getTime();

    const update = () => {
      const now = new Date().getTime();
      const diff = target - now;
      
      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h left`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m left`);
      } else {
        setTimeLeft(`${minutes}m left`);
      }
    };
    
    update();
    const interval = setInterval(update, 60000); // update every minute
    return () => clearInterval(interval);
  }, [endDateStr]);

  if (!timeLeft) return <>{endDateStr}</>;

  const isUrgent = timeLeft.includes('m left') || (timeLeft.includes('h') && !timeLeft.includes('d'));

  return (
    <span className={timeLeft === 'Expired' ? 'text-red-400 font-bold' : isUrgent ? 'text-orange-400 font-bold' : 'text-emerald-400 font-medium'}>
      {timeLeft}
    </span>
  );
}
