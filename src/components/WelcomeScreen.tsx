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
      <div className="fixed inset-0 flex items-center justify-center bg-[#000000]">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-24 h-24 rounded-[2rem] bg-blue-600 flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.3)]">
            <Tv2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Sync Watch
          </h1>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#000000] relative overflow-hidden font-sans">
      <div className="flex-1 px-6 pt-24 pb-6 flex flex-col">
        <AnimatePresence>
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex-1 flex flex-col max-w-sm mx-auto w-full"
          >
            <div className="space-y-4 mb-12">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 mb-6 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Tv2 className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white leading-tight">
                Welcome to<br/>Sync Watch
              </h1>
              <p className="text-gray-400 text-lg">
                Enter your name to join the watch party.
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
              className="mt-auto space-y-4 pb-safe flex flex-col flex-1"
            >
              <div className="mt-auto mb-6">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-0 py-4 text-2xl bg-transparent border-b-2 border-gray-800 focus:border-blue-500 outline-none text-white transition-all placeholder:text-gray-600 font-medium rounded-none"
                  maxLength={20}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={!name.trim()}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold rounded-[2rem] transition-all shadow-[0_8px_30px_rgb(0,0,0,0.12)] disabled:shadow-none flex items-center justify-center gap-2 text-lg active:scale-95"
              >
                <span>Continue</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
