import React, { useState } from "react";
import { User } from "../types";
import { addRecentRoom, getRecentRooms, resetIdentity, saveUser } from "../store";
import { LogIn, Plus, Users, Settings, LogOut, Check, ChevronRight, Play } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function HomeScreen({ 
  user, 
  onJoinRoom,
  onReset
}: { 
  user: User;
  onJoinRoom: (roomId: string) => void;
  onReset: () => void;
}) {
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const recentRooms = getRecentRooms();

  const [errorMsg, setErrorMsg] = useState("");

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(""), 3000);
  };

  const handleCreateRoom = async () => {
    setIsJoining(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create room");
      const data = await res.json();
      if (data.id) {
        addRecentRoom(data.id);
        onJoinRoom(data.id);
      }
    } catch (err) {
      console.error(err);
      showError("Could not create room. Try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length === 6) {
      setIsJoining(true);
      try {
        const res = await fetch(`/api/rooms/${code}`);
        if (!res.ok) {
          throw new Error("Room not found");
        }
        addRecentRoom(code);
        onJoinRoom(code);
      } catch (err) {
        showError("Room not found or invalid.");
      } finally {
        setIsJoining(false);
      }
    } else {
      showError("Enter a valid 6-digit code");
    }
  };

  const handleSaveName = () => {
    if (editName.trim() && editName !== user.name) {
      saveUser(editName.trim());
      window.location.reload();
    }
  };

  const handleReset = () => {
    resetIdentity();
    onReset();
  };

  return (
    <div className="min-h-screen bg-[#000000] text-gray-100 relative overflow-hidden font-sans flex flex-col">
      {/* Toast Notification */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="absolute top-12 left-1/2 z-50 bg-[#222] border border-white/10 text-white px-5 py-3 rounded-full text-sm font-medium shadow-2xl whitespace-nowrap flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-red-500" />
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top App Bar (Android Style) */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between bg-[#000000] shrink-0 sticky top-0 z-20">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
          Sync Watch
        </h1>
        <button 
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-full bg-[#111] border border-white/5 flex items-center justify-center text-gray-300 font-bold uppercase shadow-sm active:scale-95 transition-transform"
        >
          {user.name.charAt(0)}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32 max-w-2xl mx-auto w-full space-y-8">
        
        {/* Join Room Card */}
        <div className="space-y-3">
          <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider ml-1">Join a Room</h2>
          <form onSubmit={handleJoin} className="bg-[#111] rounded-[2rem] p-2 pr-3 shadow-lg border border-white/5 flex items-center focus-within:border-white/20 transition-colors">
            <div className="pl-4 pr-2 text-gray-500">
              <LogIn className="w-6 h-6" />
            </div>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="flex-1 bg-transparent py-4 text-base font-bold tracking-widest placeholder:text-gray-600 outline-none uppercase text-white"
            />
            <button 
              type="submit" 
              disabled={isJoining || joinCode.length !== 6}
              className="px-6 py-3.5 bg-white hover:bg-gray-200 disabled:bg-gray-800 disabled:text-gray-500 text-black font-bold rounded-[1.5rem] transition-colors shadow-md disabled:shadow-none"
            >
              Join
            </button>
          </form>
        </div>

        {/* Recent Rooms */}
        {recentRooms.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider ml-1">Recent Rooms</h2>
            <div className="space-y-2">
              {recentRooms.map((roomId) => (
                <button
                  key={roomId}
                  onClick={() => onJoinRoom(roomId)}
                  className="w-full flex items-center justify-between p-4 bg-[#111] rounded-[1.5rem] active:scale-[0.98] transition-all text-left group border border-white/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1rem] bg-[#1a1a1a] flex items-center justify-center text-blue-500">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-lg tracking-wide text-white">{roomId}</p>
                      <p className="text-sm font-medium text-gray-500">Tap to rejoin</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FAB (Floating Action Button) for Android Feel */}
      <div className="fixed bottom-8 right-6 z-30">
        <button
          onClick={handleCreateRoom}
          disabled={isJoining}
          className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white pl-5 pr-6 py-4 rounded-[2rem] shadow-[0_8px_30px_rgb(59,130,246,0.3)] active:scale-95 transition-all font-bold text-base"
        >
          <Plus className="w-6 h-6" />
          Create Room
        </button>
      </div>

      {/* Settings Modal - Bottom Sheet Style */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 flex flex-col justify-end backdrop-blur-sm"
          >
            <div className="absolute inset-0" onClick={() => setShowSettings(false)} />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-[#111] rounded-t-[2rem] p-6 relative z-10 border-t border-white/10 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6" />
              
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-white">Settings</h2>
              </div>
              
              <div className="space-y-8 pb-safe">
                <div className="space-y-4">
                  <label className="text-[13px] font-bold text-gray-500 uppercase tracking-wider ml-1">Your Name</label>
                  <div className="flex gap-2 bg-[#1a1a1a] rounded-[1.5rem] p-2 border border-white/5">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-4 py-3 text-base bg-transparent border-none outline-none text-white font-medium placeholder:text-gray-600"
                      placeholder="Enter new name"
                    />
                    <button 
                      onClick={handleSaveName}
                      className="px-6 bg-white hover:bg-gray-200 text-black rounded-[1rem] transition-colors flex items-center justify-center font-bold"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={handleReset}
                    className="w-full flex items-center justify-center gap-3 p-4 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-[1.5rem] font-bold transition-colors border border-red-500/10"
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out & Clear Data
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
