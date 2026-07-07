/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { User } from "./types";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { HomeScreen } from "./components/HomeScreen";
import { RoomScreen } from "./components/RoomScreen";
import { getUser } from "./store";
import { motion, AnimatePresence } from "motion/react";

type ScreenState = "welcome" | "home" | "room";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentScreen, setCurrentScreen] = useState<ScreenState>("welcome");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  useEffect(() => {
    // Check for user in local storage
    const savedUser = getUser();
    if (savedUser) {
      setUser(savedUser);
      
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      
      if (roomParam) {
        setActiveRoomId(roomParam);
        setCurrentScreen("room");
      } else {
        setCurrentScreen("home");
      }
    }
    
    // Add dark mode classes for theme setup
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleWelcomeComplete = (newUser: User) => {
    setUser(newUser);
    
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setActiveRoomId(roomParam);
      setCurrentScreen("room");
    } else {
      setCurrentScreen("home");
    }
  };

  const handleJoinRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setCurrentScreen("room");
    window.history.pushState({}, document.title, window.location.pathname + `?room=${roomId}`);
  };

  const handleLeaveRoom = () => {
    setActiveRoomId(null);
    setCurrentScreen("home");
    window.history.pushState({}, document.title, window.location.pathname);
  };

  return (
    <div className="h-[100dvh] w-full bg-[#000000] text-gray-100 overflow-x-hidden selection:bg-blue-500/30 transition-colors duration-500 font-sans">
      
      <AnimatePresence mode="wait">
        {currentScreen === "welcome" && (
          <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <WelcomeScreen onComplete={handleWelcomeComplete} />
          </motion.div>
        )}
        
        {currentScreen === "home" && user && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <HomeScreen 
              user={user} 
              onJoinRoom={handleJoinRoom} 
              onReset={() => {
                setUser(null);
                setCurrentScreen("welcome");
              }}
            />
          </motion.div>
        )}

        {currentScreen === "room" && user && activeRoomId && (
          <motion.div key="room" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <RoomScreen 
              user={user} 
              roomId={activeRoomId} 
              onLeave={handleLeaveRoom} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
