// TimerBar UI component
import { useEffect, useState } from 'react';

const TimerBar = ({ duration, onComplete }: { duration: number; onComplete: () => void }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, onComplete]);

  return (
    <div className="timer-bar">
      <div style={{ width: `${(timeLeft / duration) * 100}%` }} className="timer-bar-inner" />
    </div>
  );
};

export default TimerBar;
