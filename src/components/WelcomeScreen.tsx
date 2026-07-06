import { useState, useEffect } from "react";
import { User } from "../types";
import { getUser, saveUser } from "../store";
import { motion, AnimatePresence } from "motion/react";
import { Tv2, ArrowRight } from "lucide-react";

export function WelcomeScreen({ onComplete }: { onComplete: (user: User) => void }) {
  const [name, setName] = useState("");
  const [isSplash, setIsSplash] = useState(true);

  useEffect(() => {
    const user = getUser();
    const timer = setTimeout(() => {
      if (user) {
        onComplete(user);
      } else {
        setIsSplash(false);
      }
    }, 2000); // Splash screen for 2s max

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (isSplash) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#fcfcfc] dark:bg-[#06090e]">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-5"
        >
          <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-tr from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 shadow-xl shadow-blue-500/10">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-t-[3px] border-r-[3px] border-blue-500/50 mix-blend-overlay"
            />
            <Tv2 className="w-12 h-12 text-blue-600 dark:text-blue-400 drop-shadow-md" />
          </div>
          <h1 className="text-3xl font-bold tracking-tighter text-gray-900 dark:text-white font-sans bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
            SyncWatch
          </h1>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcfcfc] dark:bg-[#06090e] p-6 relative overflow-hidden font-sans">
      {/* Background blobs for premium feel */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

      <AnimatePresence>
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-sm space-y-10 relative z-10"
        >
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-white dark:bg-[#111724] shadow-xl shadow-blue-500/5 border border-gray-100 dark:border-gray-800 mb-6">
              <Tv2 className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              Watch Together
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Enter your name to start syncing
            </p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) {
                const user = saveUser(name.trim());
                onComplete(user);
              }
            }}
            className="space-y-4"
          >
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-6 py-4 text-lg bg-white dark:bg-[#111724] border border-gray-200/50 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none text-gray-900 dark:text-white transition-all shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-600 font-medium"
                maxLength={20}
                required
              />
            </div>
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-blue-500/25 active:scale-[0.98] disabled:active:scale-100"
            >
              <span>Continue</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
