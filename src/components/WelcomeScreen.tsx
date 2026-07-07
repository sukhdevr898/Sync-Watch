import { useState, useEffect } from "react";
import { User } from "../types";
import { getUser, saveUser } from "../store";
import { motion, AnimatePresence } from "motion/react";
import { Tv2, ArrowRight, Play, Sparkles } from "lucide-react";

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
      <div className="fixed inset-0 flex items-center justify-center bg-[#030712] overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[30rem] h-[30rem] bg-indigo-500/20 rounded-full blur-[100px]" />
        </div>
        
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-8 relative z-10"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-50 rounded-full" />
            <div className="w-28 h-28 rounded-[2.5rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center relative shadow-2xl border border-white/10">
              <Play className="w-12 h-12 text-white fill-white ml-2" />
            </div>
          </div>
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-center space-y-2"
          >
            <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
              Sync Watch
            </h1>
            <p className="text-indigo-200/60 font-medium tracking-wide text-sm uppercase">Shared Experiences</p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-[#030712] relative overflow-hidden font-sans">
      {/* Premium Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-[60%] -left-[10%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[120px]" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)]" />
      </div>

      <div className="flex-1 px-6 pt-16 pb-8 flex flex-col relative z-10 h-full">
        <AnimatePresence>
          <motion.div 
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col max-w-sm mx-auto w-full h-full justify-between"
          >
            <div className="space-y-8 mt-12">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
                className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.3)] border border-white/10"
              >
                <Play className="w-8 h-8 text-white fill-white ml-1" />
              </motion.div>
              
              <div className="space-y-3">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wide uppercase"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Next Gen</span>
                </motion.div>
                <h1 className="text-5xl font-black tracking-tighter text-white leading-[1.1]">
                  Watch<br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Together.</span>
                </h1>
                <p className="text-gray-400 text-lg leading-relaxed mt-2 font-medium">
                  Experience synchronized streaming with your friends in real-time.
                </p>
              </div>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) {
                  const user = saveUser(name.trim());
                  onComplete(user);
                }
              }}
              className="mt-auto space-y-6 flex flex-col mb-4"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition-opacity duration-500" />
                <div className="relative bg-[#0F172A]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden transition-colors focus-within:border-indigo-500/50">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name..."
                    className="w-full px-6 py-5 text-xl bg-transparent outline-none text-white transition-all placeholder:text-gray-600 font-medium"
                    maxLength={20}
                    required
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={!name.trim()}
                className="group relative w-full py-5 bg-white disabled:bg-white/10 disabled:text-white/30 text-black font-bold rounded-2xl transition-all flex items-center justify-center gap-3 text-lg active:scale-[0.98] overflow-hidden shadow-xl"
              >
                {!name.trim() ? null : (
                   <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <span className="relative z-10">Get Started</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-disabled:opacity-50 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
