import React, { useState } from "react";
import { User } from "../types";
import { addRecentRoom, getRecentRooms, removeRecentRoom, resetIdentity, saveUser } from "../store";
import { LogIn, Plus, Settings, LogOut, Check, Copy, Trash2, Clock, ChevronRight } from "lucide-react";
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
  const [recentRooms, setRecentRooms] = useState(() => getRecentRooms());

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(""), 3000);
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const updateRecentRooms = () => {
    setRecentRooms(getRecentRooms());
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

  const handleDeleteRoom = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    removeRecentRoom(roomId);
    updateRecentRooms();
  };

  const handleCopyLink = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    const link = `${window.location.origin}?room=${roomId}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => showSuccess("Link copied!")).catch(() => showError("Failed to copy"));
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showSuccess("Link copied!");
      } catch (err) {
        showError("Failed to copy");
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-[#000000] text-gray-100 flex flex-col overflow-hidden font-sans relative">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] -left-[20%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Toast Notifications */}
      <div className="absolute top-12 left-0 right-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-4">
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="bg-[#1A0B0B] border border-red-500/30 text-red-200 px-5 py-3.5 rounded-2xl text-sm font-medium shadow-2xl flex items-center gap-3 w-full max-w-sm backdrop-blur-xl"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="truncate">{errorMsg}</span>
            </motion.div>
          )}
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="bg-[#0B1A10] border border-green-500/30 text-green-200 px-5 py-3.5 rounded-2xl text-sm font-medium shadow-2xl flex items-center gap-3 w-full max-w-sm backdrop-blur-xl"
            >
              <Check className="w-4 h-4 text-green-400 shrink-0" />
              <span className="truncate">{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div className="px-6 pt-14 pb-6 flex items-center justify-between relative z-10 shrink-0">
        <div>
          <p className="text-gray-400 text-xs font-semibold tracking-widest uppercase mb-1.5">Welcome back</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">{user.name}</h1>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="w-12 h-12 rounded-full bg-[#09090B] border border-white/10 flex items-center justify-center active:scale-95 transition-transform shadow-lg"
        >
          <Settings className="w-5 h-5 text-gray-300" />
        </button>
      </div>

      {/* Actions */}
      <div className="px-6 flex flex-col gap-5 relative z-10 shrink-0">
        {/* Create Room */}
        <button
          onClick={handleCreateRoom}
          disabled={isJoining}
          className="relative p-[1px] rounded-[2rem] overflow-hidden group active:scale-[0.98] transition-transform w-full text-left"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-50 group-active:opacity-100 transition-opacity" />
          <div className="relative bg-[#09090B] rounded-[2rem] p-5 flex items-center justify-between">
             <div className="flex items-center gap-4">
               <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0">
                 {isJoining ? (
                   <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 ) : (
                   <Plus className="w-6 h-6" />
                 )}
               </div>
               <div>
                 <h3 className="text-lg font-bold text-white">New Room</h3>
                 <p className="text-sm text-gray-400 mt-0.5">Host a watch party</p>
               </div>
             </div>
             <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 group-active:text-white transition-colors shrink-0">
               <ChevronRight className="w-5 h-5" />
             </div>
          </div>
        </button>

        {/* Join Room */}
        <form
          onSubmit={handleJoin}
          className="relative bg-[#09090B] border border-white/10 rounded-[2rem] p-2 flex items-center focus-within:border-indigo-500/50 focus-within:shadow-[0_0_30px_rgba(99,102,241,0.1)] transition-all"
        >
          <div className="pl-5 pr-3 text-gray-500 shrink-0">
            <LogIn className="w-6 h-6" />
          </div>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="ENTER CODE"
            className="flex-1 bg-transparent py-4 text-white font-mono text-xl tracking-[0.2em] outline-none placeholder:text-gray-700 w-full min-w-0"
          />
          <button
            type="submit"
            disabled={joinCode.length !== 6 || isJoining}
            className="h-14 px-8 bg-white disabled:bg-white/5 text-black disabled:text-white/20 font-bold rounded-[1.5rem] active:scale-95 transition-transform shrink-0"
          >
            {isJoining ? '...' : 'Join'}
          </button>
        </form>
      </div>

      {/* Recent Rooms */}
      {recentRooms.length > 0 && (
        <div className="flex-1 mt-8 flex flex-col min-h-0 relative z-10">
          <div className="px-8 mb-3 shrink-0">
            <h3 className="text-xs font-semibold text-gray-500 tracking-widest uppercase">History</h3>
          </div>
          <div className="flex-1 overflow-y-auto px-6 space-y-3 pb-8 custom-scrollbar">
            {recentRooms.map((roomId) => (
              <div
                key={roomId}
                onClick={() => onJoinRoom(roomId)}
                className="bg-[#09090B] border border-white/5 rounded-[1.75rem] p-3 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer group"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0 ml-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-mono text-[17px] font-semibold truncate">{roomId}</p>
                    <p className="text-xs font-medium text-gray-500 truncate mt-0.5">Tap to rejoin session</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 pr-1">
                  <button
                    onClick={(e) => handleCopyLink(e, roomId)}
                    className="w-12 h-12 rounded-full bg-transparent hover:bg-white/5 flex items-center justify-center text-gray-400 active:bg-white/10 transition-colors"
                    title="Copy Link"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteRoom(e, roomId)}
                    className="w-12 h-12 rounded-full bg-transparent hover:bg-red-500/10 flex items-center justify-center text-gray-400 hover:text-red-400 active:bg-red-500/20 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Modal - Bottom Sheet */}
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
              transition={{ type: "spring", damping: 28, stiffness: 250 }}
              className="bg-[#09090B] border-t border-white/10 rounded-t-[2.5rem] relative z-10 w-full max-w-xl mx-auto flex flex-col max-h-[85vh] p-6 pb-safe"
            >
              <div className="w-12 h-1.5 bg-gray-800 rounded-full mx-auto mb-8 shrink-0" />
              
              <h2 className="text-2xl font-bold text-white mb-6 px-2 shrink-0">Settings</h2>
              
              <div className="overflow-y-auto custom-scrollbar">
                {/* Profile Section */}
                <div className="bg-white/5 border border-white/5 rounded-[2rem] p-5 mb-4">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest ml-2 mb-3 block">Display Name</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-black/50 border border-white/10 rounded-[1.25rem] px-5 py-4 text-white text-[15px] outline-none focus:border-indigo-500/50 transition-colors min-w-0"
                      placeholder="Enter name"
                    />
                    <button 
                      onClick={handleSaveName}
                      disabled={!editName.trim() || editName === user.name}
                      className="px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-white/20 text-white font-semibold rounded-[1.25rem] transition-colors flex items-center justify-center shrink-0"
                    >
                      Save
                    </button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-500/5 border border-red-500/10 rounded-[2rem] p-5">
                  <label className="text-xs font-semibold text-red-500/70 uppercase tracking-widest ml-2 mb-3 block">Danger Zone</label>
                  
                  <p className="text-[13px] text-gray-400 px-2 mb-4">
                    This will clear all your local data, including your name and room history.
                  </p>
                  
                  <button 
                    onClick={handleReset}
                    className="w-full flex items-center justify-center gap-2 py-4 text-red-500 bg-red-500/10 active:bg-red-500/20 rounded-[1.25rem] font-semibold transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    Clear Data & Sign Out
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

