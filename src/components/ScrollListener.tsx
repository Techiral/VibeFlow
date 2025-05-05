"use client";

import { useEffect } from 'react';

const ScrollListener = () => {
  useEffect(() => {
    const handleScroll = () => {
      const scrollProgress = document.getElementById('scroll-progress') as HTMLProgressElement;
      if (scrollProgress) {
        const totalHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrollPosition = (document.documentElement.scrollTop / totalHeight) * 100;
        scrollProgress.value = scrollPosition;
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <progress className="w-full h-2 bg-gray-200 rounded-full mt-4" value="0" max="100" id="scroll-progress" style={{ appearance: 'none' }}/>
  );
};

export default ScrollListener;
