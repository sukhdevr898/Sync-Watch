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
import { ThemeToggle } from "./components/ThemeToggle";
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
      setCurrentScreen("home");
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
    setCurrentScreen("home");
  };

  const handleJoinRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setCurrentScreen("room");
  };

  const handleLeaveRoom = () => {
    setActiveRoomId(null);
    setCurrentScreen("home");
  };

  return (
    <div className="min-h-screen w-full bg-[#fcfcfc] dark:bg-[#06090e] text-gray-900 dark:text-gray-100 overflow-x-hidden selection:bg-blue-500/30 transition-colors duration-500 font-sans">
      
      {currentScreen !== "room" && (
        <div className="absolute top-6 right-6 z-50">
          <ThemeToggle />
        </div>
      )}

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
