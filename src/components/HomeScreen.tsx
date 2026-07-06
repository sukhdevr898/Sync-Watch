import React, { useState } from "react";
import { User } from "../types";
import { addRecentRoom, getRecentRooms, resetIdentity, saveUser } from "../store";
import { LogIn, Plus, Users, Settings, X, LogOut, Check, ChevronLeft } from "lucide-react";
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
      // For simplicity, we just reload to apply identity change globally
      window.location.reload();
    }
  };

  const handleReset = () => {
    resetIdentity();
    onReset();
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] dark:bg-[#06090e] text-gray-900 dark:text-gray-100 pb-24 relative overflow-hidden font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="absolute top-6 left-1/2 z-50 bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl text-sm font-medium shadow-lg whitespace-nowrap"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar */}
      <div className="max-w-2xl mx-auto px-6 pt-16 pb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-xl uppercase shadow-md shadow-blue-500/20">
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Welcome back,</p>
            <h2 className="text-2xl font-bold tracking-tight">{user.name}</h2>
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="w-12 h-12 rounded-2xl bg-white dark:bg-[#111724] border border-gray-200/50 dark:border-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1A2333] transition-colors shadow-sm"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-6 space-y-8">
        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={handleCreateRoom}
            disabled={isJoining}
            className="flex flex-col items-center justify-center gap-4 p-8 bg-white dark:bg-[#111724] border border-gray-200/50 dark:border-gray-800 rounded-[2rem] active:scale-[0.98] transition-all hover:shadow-lg hover:shadow-blue-500/5 dark:hover:shadow-blue-500/10 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-semibold text-lg">Create Room</span>
          </button>

          <form
            onSubmit={handleJoin}
            className="flex flex-col items-center justify-center gap-4 p-8 bg-white dark:bg-[#111724] border border-gray-200/50 dark:border-gray-800 rounded-[2rem] hover:shadow-lg hover:shadow-indigo-500/5 dark:hover:shadow-indigo-500/10 group relative"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-focus-within:scale-110 transition-transform duration-300">
              <LogIn className="w-6 h-6" />
            </div>
            <div className="w-full">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                maxLength={6}
                className="w-full bg-gray-50 dark:bg-[#0A0F18] border border-transparent focus:border-indigo-500/50 rounded-xl py-3 text-center font-bold tracking-widest placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none uppercase transition-all"
              />
            </div>
            {/* hidden submit for form */}
            <button type="submit" className="hidden" />
          </form>
        </div>

        {/* Recent Rooms */}
        {recentRooms.length > 0 && (
          <div className="space-y-5 pt-6">
            <h3 className="text-lg font-semibold tracking-tight">Recent Rooms</h3>
            <div className="grid gap-3">
              {recentRooms.map((roomId) => (
                <button
                  key={roomId}
                  onClick={() => onJoinRoom(roomId)}
                  className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#111724] border border-gray-200/50 dark:border-gray-800 rounded-2xl active:scale-[0.99] transition-all hover:shadow-md text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-[#0A0F18] border border-gray-100 dark:border-gray-800 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-colors">
                      <Users className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg tracking-wide">{roomId}</p>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-500">Tap to rejoin</p>
                    </div>
                  </div>
                  <ChevronLeft className="w-5 h-5 rotate-180 text-gray-300 dark:text-gray-700 group-hover:text-gray-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[100] bg-white/95 dark:bg-[#06090e]/95 backdrop-blur-xl flex flex-col items-center pt-24 px-6"
          >
            <div className="w-full max-w-md w-full">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#111724] flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#1A2333] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Change Name</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-5 py-4 text-lg bg-gray-50 dark:bg-[#111724] border border-gray-200/50 dark:border-gray-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                    />
                    <button 
                      onClick={handleSaveName}
                      className="px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-colors flex items-center justify-center shadow-md shadow-blue-500/20"
                    >
                      <Check className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-6 mt-6 border-t border-gray-200/50 dark:border-gray-800">
                  <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Danger Zone</label>
                  <button 
                    onClick={handleReset}
                    className="w-full flex items-center justify-center gap-3 p-5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-2xl font-semibold transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    Reset Identity & Clear Data
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
