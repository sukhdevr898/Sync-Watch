import React, { useState, useEffect, useRef } from "react";
import { User, Message, VideoState } from "../types";
import { io, Socket } from "socket.io-client";
import ReactPlayer from "react-player";
import { Copy, ChevronLeft, Send, Users, Search, MessageCircle, Mic, MicOff, Video, VideoOff, SwitchCamera, X, AlertCircle, RefreshCw, Play, Volume2, Settings, Wifi, PhoneOff } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

const SOCKET_URL = undefined; // Let Socket.IO automatically use window.location

// Connection Indicator Component
function ConnectionIndicator({ status, latency }: { status: string, latency: number | null }) {
  const getStatusColor = () => {
    if (status === "connected") return "bg-emerald-500";
    if (status === "connecting" || status === "waiting") return "bg-amber-500";
    return "bg-red-500";
  };

  const getStatusText = () => {
    if (status === "waiting") return "Waiting for peer";
    if (status === "connecting") return "Connecting...";
    if (status === "disconnected") return "Disconnected";
    return "Connected";
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 shadow-lg select-none">
      <div className="relative flex items-center justify-center w-2 h-2">
        {(status === "connecting" || status === "waiting") && (
          <span className="absolute inline-flex w-3 h-3 rounded-full opacity-75 animate-ping bg-amber-500" />
        )}
        <div className={cn("w-2 h-2 rounded-full", getStatusColor())} />
      </div>
      <span className="text-[11px] font-semibold text-white/90 tracking-wide">
        {getStatusText()}
      </span>
      {status === "connected" && latency !== null && (
        <>
          <div className="w-px h-3 bg-white/20 mx-1" />
          <div className="flex items-center gap-1 opacity-90" title="WebRTC Latency">
            <Wifi className="w-3 h-3 text-white/50" />
            <span className={cn("text-[11px] font-mono", latency < 100 ? "text-emerald-400" : latency < 300 ? "text-amber-400" : "text-red-400")}>
              {latency}ms
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export function RoomScreen({
  user,
  roomId,
  onLeave,
}: {
  user: User;
  roomId: string;
  onLeave: () => void;
}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const videoUrlRef = useRef(videoUrl);
  useEffect(() => { videoUrlRef.current = videoUrl; }, [videoUrl]);

  const [urlInput, setUrlInput] = useState("");
  
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  const [playerError, setPlayerError] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [playerVolume, setPlayerVolume] = useState(1);
  
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  
  const [showSearch, setShowSearch] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState<{message: string, id: number} | null>(null);

  const usersRef = useRef<User[]>(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const showToast = (message: string) => {
    const id = Date.now();
    setToast({ message, id });
    setTimeout(() => {
      setToast(current => current?.id === id ? null : current);
    }, 3000);
  };
  
  // Video Call State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [callVolume, setCallVolume] = useState(1);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>("");
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "waiting">("waiting");
  const [latency, setLatency] = useState<number | null>(null);
  const [reactions, setReactions] = useState<{id: string, emoji: string, x: number}[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const currentQualityRef = useRef<"high" | "low">("high");

  const playerRef = useRef<any>(null);
  const isSyncingRef = useRef(false);
  const lastStateUpdateRef = useRef(0);
  const ignoreNextTimeUpdateRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const pendingCandidates = useRef<any[]>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (pcRef.current && (pcRef.current.iceConnectionState === "connected" || pcRef.current.iceConnectionState === "completed")) {
        try {
          const stats = await pcRef.current.getStats();
          let currentLatency = 0;
          stats.forEach(report => {
            if (report.type === "candidate-pair" && report.state === "succeeded") {
              if (report.currentRoundTripTime !== undefined) {
                currentLatency = report.currentRoundTripTime * 1000;
              }
            }
          });
          if (currentLatency > 0) {
            setLatency(Math.round(currentLatency));
            
            // Network quality adaptation
            if (currentLatency > 400 && currentQualityRef.current === "high" && localStreamRef.current && !isVideoOff) {
              const videoTrack = localStreamRef.current.getVideoTracks()[0];
              if (videoTrack) {
                videoTrack.applyConstraints({ width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } })
                  .then(() => { currentQualityRef.current = "low"; console.log("Downgraded video quality due to slow network"); })
                  .catch(console.error);
              }
            } else if (currentLatency < 200 && currentQualityRef.current === "low" && localStreamRef.current && !isVideoOff) {
              const videoTrack = localStreamRef.current.getVideoTracks()[0];
              if (videoTrack) {
                videoTrack.applyConstraints({ width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } })
                  .then(() => { currentQualityRef.current = "high"; console.log("Upgraded video quality due to good network"); })
                  .catch(console.error);
              }
            }
          }
        } catch (e) {}
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isVideoOff]);

  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);
    socketRef.current = s;

    s.on("user-joined", (updatedUsers: User[]) => {
      const newUsers = updatedUsers.filter(u => !usersRef.current.find(old => old.id === u.id));
      if (usersRef.current.length > 0) {
        newUsers.forEach(u => {
          if (u.id !== user.id) showToast(`👋 ${u.name} joined the room`);
        });
      }
      setUsers(updatedUsers);
      
      if (updatedUsers.length > 1 && updatedUsers[0].id === user.id) {
        const time = playerRef.current?.getCurrentTime?.() || 0;
        s.emit("video-update", { videoUrl: videoUrlRef.current, isPlaying: isPlayingRef.current, currentTime: time });
        initiateCall();
      }
    });

    s.on("user-left", (updatedUsers: User[]) => {
      const leftUsers = usersRef.current.filter(old => !updatedUsers.find(u => u.id === old.id));
      leftUsers.forEach(u => showToast(`👋 ${u.name} left the room`));
      setUsers(updatedUsers);
      setRemoteStream(null);
      setConnectionStatus("waiting");
      setLatency(null);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      setupWebRTC();
    });

    s.on("chat-message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.userId !== user.id) {
        setHasNewMessage(true);
      }
    });

    s.on("video-state", (state: VideoState) => {
      isSyncingRef.current = true;
      let isNewVideo = false;
      if (state.videoUrl !== undefined && state.videoUrl !== videoUrlRef.current) {
        setVideoUrl(state.videoUrl);
        setUrlInput(state.videoUrl);
        setPlayerError(false);
        isNewVideo = true;
      }
      if (state.isPlaying !== undefined) setIsPlaying(state.isPlaying);
      if (state.currentTime !== undefined) {
        if (!isNewVideo && playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            const currentLocal = playerRef.current.getCurrentTime();
            if (Math.abs(currentLocal - state.currentTime) > 2) {
              playerRef.current.seekTo(state.currentTime, "seconds");
            }
          } catch (e) {
            console.error("Seek error", e);
          }
        } else {
          pendingSeekRef.current = state.currentTime;
        }
      }
      setTimeout(() => { isSyncingRef.current = false; }, 500);
    });

    s.on("error", (msg) => {
      setRoomError(msg);
    });

    s.on("reaction", (data: { emoji: string }) => {
      const newReaction = { id: Math.random().toString(), emoji: data.emoji, x: Math.random() * 80 + 10 };
      setReactions(prev => [...prev, newReaction]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== newReaction.id));
      }, 2500);
    });

    s.on("webrtc-signal", async (data: { from: string; signal: any }) => {
      if (data.from === user.id) return;
      const signal = data.signal;
      
      if (!pcRef.current) setupWebRTC();
      const pc = pcRef.current!;
      
      try {
        if (signal.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          s.emit("webrtc-signal", pc.localDescription);
          pendingCandidates.current.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
          pendingCandidates.current = [];
        } else if (signal.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          pendingCandidates.current.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
          pendingCandidates.current = [];
        } else if (signal.type === "candidate") {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            pendingCandidates.current.push(signal.candidate);
          }
        }
      } catch (err) {
        console.error("WebRTC Error handling signal", err);
      }
    });

    return () => {
      s.disconnect();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (pcRef.current) pcRef.current.close();
    };
  }, [roomId, user]);

  useEffect(() => {
    if (showChat) setHasNewMessage(false);
  }, [showChat]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
        const playPromise = localVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            if (e.name !== 'AbortError') {
              console.error("Local video play error:", e);
            }
          });
        }
      }
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        const playPromise = remoteVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            if (e.name !== 'AbortError') {
              console.error("Remote video play error:", e);
            }
          });
        }
      }
    }
  }, [remoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      if (typeof (remoteVideoRef.current as any).setSinkId === "function" && selectedAudioOutput) {
        (remoteVideoRef.current as any).setSinkId(selectedAudioOutput).catch(console.error);
      }
    }
  }, [selectedAudioOutput]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = callVolume;
    }
  }, [callVolume]);

  const initMedia = async (deviceId?: string) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera/Microphone not supported (secure HTTPS context required).");
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: deviceId 
          ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } } 
          : { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      stream.getAudioTracks().forEach(t => (t.enabled = !isMuted));
      stream.getVideoTracks().forEach(t => (t.enabled = !isVideoOff));
      
      setLocalStream(stream);
      localStreamRef.current = stream;

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");
      setCameraDevices(videoDevices);
      
      const audioOut = devices.filter(d => d.kind === "audiooutput");
      setAudioOutputDevices(audioOut);
      if (audioOut.length > 0 && !selectedAudioOutput) {
        setSelectedAudioOutput(audioOut[0].deviceId);
      }

      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        stream.getTracks().forEach(track => {
          const sender = senders.find(s => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(console.error);
          } else {
            pcRef.current!.addTrack(track, stream);
          }
        });
      }
      setMediaError(null);
      return stream;
    } catch (err: any) {
      console.error("Error accessing media devices.", err);
      setMediaError(err.message || "Permission denied or no devices found.");
      showToast("Camera/Microphone access denied.");
      return null;
    }
  };

  const setupWebRTC = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    });

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        setConnectionStatus("connected");
      } else if (state === "disconnected" || state === "failed" || state === "closed") {
        setConnectionStatus("disconnected");
        setLatency(null);
      } else {
        setConnectionStatus("connecting");
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("webrtc-signal", { type: "candidate", candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    }

    pcRef.current = pc;
    return pc;
  };

  const initiateCall = async () => {
    if (!pcRef.current) setupWebRTC();
    const pc = pcRef.current!;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current?.emit("webrtc-signal", pc.localDescription);
  };

  useEffect(() => {
    initMedia().then((stream) => {
      if (!pcRef.current) setupWebRTC();
      if (socket) {
        socket.emit("join-room", { roomId, user });
      }
    });
  }, [socket]);

  const emitVideoState = (state: VideoState, force = false) => {
    if (!socket || isSyncingRef.current) return;
    const now = Date.now();
    if (!force && now - lastStateUpdateRef.current < 1000) return;
    lastStateUpdateRef.current = now;
    socket.emit("video-update", state);
  };

  const handlePlay = () => {
    if (isSyncingRef.current) return;
    setIsPlaying(true);
    const time = playerRef.current?.getCurrentTime?.() || 0;
    emitVideoState({ isPlaying: true, currentTime: time }, true);
  };

  const handlePause = () => {
    if (isSyncingRef.current) return;
    setIsPlaying(false);
    const time = playerRef.current?.getCurrentTime?.() || 0;
    emitVideoState({ isPlaying: false, currentTime: time }, true);
  };

  const handleSeek = (seconds: number) => {
    if (isSyncingRef.current) return;
    ignoreNextTimeUpdateRef.current = true;
    emitVideoState({ currentTime: seconds }, true);
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = urlInput.trim();
    if (!query) return;

    if (query.startsWith("http://") || query.startsWith("https://")) {
      setVideoUrl(query);
      setIsPlaying(true);
      setPlayerError(false);
      setShowSearch(false);
      socket?.emit("video-update", { videoUrl: query, isPlaying: true, currentTime: 0 });
    } else {
      setIsSearching(true);
      setSearchPage(0);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=0`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data);
          setHasMoreSearch(data.length === 10);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleLoadMore = async () => {
    if (isSearching || !hasMoreSearch) return;
    setIsSearching(true);
    const nextPage = searchPage + 1;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(urlInput.trim())}&page=${nextPage}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSearchResults(prev => [...prev, ...data]);
        setHasMoreSearch(data.length === 10);
        setSearchPage(nextPage);
      }
    } catch (err) {
      console.error("Search pagination failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectVideo = (url: string) => {
    setVideoUrl(url);
    setUrlInput(url);
    setIsPlaying(true);
    setPlayerError(false);
    setSearchResults([]);
    setShowSearch(false);
    socket?.emit("video-update", { videoUrl: url, isPlaying: true, currentTime: 0 });
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && socket) {
      const msg = {
        id: Math.random().toString(),
        userId: user.id,
        userName: user.name,
        text: chatInput.trim(),
      };
      socket.emit("chat-message", msg);
      setChatInput("");
    }
  };

  const sendReaction = (emoji: string) => {
    socket?.emit("reaction", { emoji });
    const newReaction = { id: Math.random().toString(), emoji, x: Math.random() * 80 + 10 };
    setReactions(prev => [...prev, newReaction]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 2500);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => { track.enabled = isMuted; });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => { track.enabled = isVideoOff; });
      setIsVideoOff(!isVideoOff);
    }
  };

  const switchCamera = () => {
    if (cameraDevices.length > 1) {
      const nextIndex = (currentCameraIndex + 1) % cameraDevices.length;
      setCurrentCameraIndex(nextIndex);
      initMedia(cameraDevices[nextIndex].deviceId);
    }
  };

  const currentConnectionStatus = users.length > 1 ? connectionStatus : "waiting";

  if (roomError) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#000000] p-6 text-center space-y-4 font-sans relative overflow-hidden">
        {/* Glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[50%] bg-red-500/10 rounded-full blur-[120px]" />
        </div>

        <div className="w-20 h-20 bg-[#09090B] text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-white/5 shadow-2xl relative z-10">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight relative z-10">Connection Error</h2>
        <p className="text-gray-400 max-w-md relative z-10">{roomError}</p>
        <button onClick={onLeave} className="px-8 py-4 bg-white text-black rounded-[1.5rem] font-bold mt-4 active:scale-95 transition-transform shadow-xl relative z-10">
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-[#000000] text-gray-100 flex flex-col overflow-hidden font-sans relative">
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="absolute top-6 left-1/2 z-[100] pointer-events-none"
          >
            <div className="bg-[#1A1D24]/90 backdrop-blur-xl text-white px-5 py-3 rounded-[1.25rem] shadow-2xl border border-white/10 text-[13px] font-semibold tracking-wide flex items-center gap-2">
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-5 shrink-0 z-20 relative">
        <div className="flex items-center gap-4">
          <button onClick={onLeave} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white active:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              SyncRoom
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
              <span className="font-mono tracking-widest">{roomId}</span>
              <button onClick={() => { 
                const link = `${window.location.origin}?room=${roomId}`;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(link).then(() => showToast("Copied Link")).catch(() => showToast("Failed to copy")); 
                } else {
                  // Fallback for non-secure contexts
                  const textArea = document.createElement("textarea");
                  textArea.value = link;
                  document.body.appendChild(textArea);
                  textArea.select();
                  try {
                    document.execCommand('copy');
                    showToast("Copied Link");
                  } catch (err) {
                    showToast("Failed to copy");
                  }
                  document.body.removeChild(textArea);
                }
              }} className="hover:text-white transition-colors" title="Copy Link">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionIndicator status={currentConnectionStatus} latency={latency} />
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white active:bg-white/10 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 overflow-hidden flex flex-col relative z-10 bg-black/40 rounded-t-[2.5rem] border-t border-white/5 group">
        
        {/* Floating Reactions Overlay */}
        <div className="absolute inset-0 pointer-events-none z-[45] overflow-hidden">
          <AnimatePresence>
            {reactions.map(r => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 50, scale: 0.5, left: `${r.x}%` }}
                animate={{ opacity: 1, y: -200, scale: 2, left: `${r.x + (Math.random() * 10 - 5)}%` }}
                exit={{ opacity: 0, scale: 3 }}
                transition={{ duration: 2.5, ease: "easeOut" }}
                className="absolute bottom-32 text-4xl filter drop-shadow-lg"
              >
                {r.emoji}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Emoji Reaction Bar */}
        <div className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-2 z-[45] opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {["👍", "😂", "❤️", "😮", "👏", "🔥"].map(emoji => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="w-12 h-12 rounded-full bg-[#09090B]/80 backdrop-blur-md text-2xl flex items-center justify-center hover:bg-white/10 hover:scale-110 active:scale-95 transition-all border border-white/10 shadow-xl"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Video Player */}
        <AnimatePresence mode="popLayout">
          {videoUrl && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full aspect-video bg-black relative shrink-0 z-10 shadow-2xl border-b border-white/5"
            >
              {playerError && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white space-y-4 p-6 text-center pointer-events-none">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                  <div>
                    <h3 className="text-lg font-bold mb-1">Playback Issue</h3>
                    <p className="text-gray-400 text-xs max-w-xs mx-auto">
                      Browser blocked autoplay or video error. Try interacting with the player.
                    </p>
                  </div>
                  <button onClick={() => setPlayerError(false)} className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-full text-sm font-semibold transition-colors">
                    <X className="w-4 h-4" /> Dismiss
                  </button>
                </div>
              )}
              <ReactPlayer
                ref={playerRef}
                url={videoUrl}
                width="100%"
                height="100%"
                playing={isPlaying}
                controls={true}
                volume={playerVolume}
                onReady={() => {
                  if (pendingSeekRef.current !== null && playerRef.current) {
                    playerRef.current.seekTo(pendingSeekRef.current, "seconds");
                    pendingSeekRef.current = null;
                  }
                }}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeeked={() => {
                  const time = playerRef.current?.getCurrentTime?.() || 0;
                  handleSeek(time);
                }}
                onError={(e) => { 
                  console.error("Player Error:", e);
                  setPlayerError(true);
                }}
                config={{ youtube: { playerVars: { origin: window.location.origin } } }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Call Area */}
        <div className="flex-1 relative bg-transparent overflow-hidden">
          {/* Remote Video (Full Size) */}
          {remoteStream ? (
            <div className="absolute inset-0">
               <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
               <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg border border-white/10">
                  {users.find(u => u.id !== user.id)?.name}
               </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative mb-6">
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-indigo-500/20"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  className="absolute inset-0 rounded-full bg-indigo-500/20"
                />
                <div className="w-24 h-24 rounded-full bg-[#09090B] flex items-center justify-center border border-white/5 shadow-[0_0_40px_rgba(79,70,229,0.1)] relative z-10">
                  <Users className="w-10 h-10 text-indigo-400/50" />
                </div>
              </div>
              <span className="font-bold text-white text-[15px] tracking-wide">Waiting for peer...</span>
              <span className="text-gray-500 text-[11px] font-medium uppercase tracking-widest mt-2 max-w-[200px] text-center">Share the link to watch together</span>
            </div>
          )}

          {/* Local Video (PiP if remote exists, Full if not) */}
          <motion.div 
            layout
            className={cn(
              "absolute overflow-hidden bg-black ring-1 ring-white/10 shadow-2xl z-20 transition-all duration-500 ease-in-out",
              remoteStream 
                ? "bottom-28 right-6 w-28 md:w-40 aspect-[3/4] rounded-2xl" 
                : "inset-0 w-full h-full"
            )}
          >
            {mediaError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm text-center p-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                  <VideoOff className="w-6 h-6 text-red-500" />
                </div>
                <span className="text-xs font-semibold text-gray-300">Camera Off</span>
              </div>
            ) : (
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn("w-full h-full object-cover scale-x-[-1]", isVideoOff && "hidden")}
                />
                {isVideoOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold uppercase shadow-2xl border border-white/20">
                      {user.name.slice(0, 2)}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xl px-2 py-1.5 rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5">
              You {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
            </div>
            {cameraDevices.length > 1 && (
               <button onClick={switchCamera} className="absolute top-2 right-2 p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-xl transition-colors z-30">
                 <SwitchCamera className="w-4 h-4" />
               </button>
            )}
          </motion.div>
        </div>
      </div>

      {/* FLOATING ACTION BAR */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#09090B]/90 backdrop-blur-2xl border border-white/10 px-3 py-3 rounded-[2rem] z-40 shadow-2xl">
        <button onClick={toggleMute} className={cn("w-14 h-14 flex items-center justify-center rounded-[1.25rem] transition-all", isMuted ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]" : "bg-white/5 text-white hover:bg-white/10")}>
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button onClick={toggleVideo} className={cn("w-14 h-14 flex items-center justify-center rounded-[1.25rem] transition-all", isVideoOff ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]" : "bg-white/5 text-white hover:bg-white/10")}>
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>
        
        <div className="w-px h-8 bg-white/10 mx-1" />
        
        <button onClick={() => { setShowSearch(!showSearch); setShowChat(false); }} className={cn("w-14 h-14 flex items-center justify-center rounded-[1.25rem] transition-all", showSearch ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]" : "bg-white/5 text-white hover:bg-white/10")}>
          <Search className="w-6 h-6" />
        </button>
        <button onClick={() => { setShowChat(!showChat); setShowSearch(false); }} className={cn("relative w-14 h-14 flex items-center justify-center rounded-[1.25rem] transition-all", showChat ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]" : "bg-white/5 text-white hover:bg-white/10")}>
          <MessageCircle className="w-6 h-6" />
          {hasNewMessage && !showChat && (
            <span className="absolute top-2 right-2 w-3.5 h-3.5 bg-red-500 border-[2.5px] border-[#09090B] rounded-full" />
          )}
        </button>
        
        <div className="w-px h-8 bg-white/10 mx-1" />
        
        <button onClick={onLeave} className="w-14 h-14 flex items-center justify-center rounded-[1.25rem] bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95">
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>

      {/* FLOATING SEARCH DRAWER */}
      <div 
        className={cn(
          "fixed bottom-28 left-4 right-4 md:left-auto md:w-[400px] bg-[#09090B]/95 backdrop-blur-3xl rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col transition-all duration-300 transform origin-bottom z-50 overflow-hidden",
          showSearch ? "h-[65vh] md:h-[500px] scale-100 opacity-100" : "h-0 scale-95 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0 bg-white/[0.02]">
          <h3 className="font-bold text-white flex items-center gap-2 text-[15px]">
            <Search className="w-4 h-4 text-indigo-400" /> Discover Video
          </h3>
          <button onClick={() => setShowSearch(false)} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full transition-colors active:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 shrink-0 border-b border-white/5">
          <form onSubmit={handleUrlSubmit}>
            <div className="relative flex items-center bg-black/50 border border-white/10 rounded-[1.25rem] p-1.5 focus-within:border-indigo-500/50 transition-colors shadow-inner">
              <Search className="w-5 h-5 text-gray-500 ml-3 mr-2" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Search YouTube or paste URL..."
                className="w-full bg-transparent border-none py-2.5 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-0 min-w-0"
              />
              <button disabled={isSearching || !urlInput.trim()} type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-[1rem] text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform shrink-0">
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Play"}
              </button>
            </div>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar pt-5">
          {searchResults.length > 0 ? (
            <div className="flex flex-col gap-3">
              {searchResults.map((video, index) => (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={`${video.id}-${index}`}
                  onClick={() => handleSelectVideo(video.url)}
                  className="w-full flex items-start gap-3 p-2 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/10 rounded-[1.25rem] transition-all duration-300 text-left group"
                >
                  <div className="relative w-28 aspect-video rounded-xl overflow-hidden shadow-lg shrink-0 bg-gray-900 border border-white/5">
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                    <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                      {video.duration}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pt-1 pr-1">
                    <h4 className="font-semibold text-[13px] text-gray-200 line-clamp-2 leading-snug mb-1.5 group-hover:text-indigo-400 transition-colors">{video.title}</h4>
                    <p className="text-[10px] text-gray-500 font-bold truncate uppercase tracking-wide">{video.author}</p>
                  </div>
                </motion.button>
              ))}
              {hasMoreSearch && (
                <button onClick={handleLoadMore} disabled={isSearching} className="w-full py-3.5 mt-2 bg-white/5 hover:bg-white/10 text-white rounded-[1.25rem] text-xs font-bold transition-colors disabled:opacity-50 tracking-wide uppercase">
                  {isSearching ? "Loading..." : "Load More"}
                </button>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 pb-8">
              <div className="w-16 h-16 mb-4 bg-white/[0.03] rounded-[1.5rem] flex items-center justify-center border border-white/5 shadow-inner">
                <Play className="w-6 h-6 text-white/30 ml-1" />
              </div>
              <p className="text-sm font-semibold text-gray-400 tracking-wide">Search for a video</p>
            </div>
          )}
        </div>
      </div>

      {/* FLOATING CHAT DRAWER */}
      <div 
        className={cn(
          "fixed bottom-28 left-4 right-4 md:left-auto md:w-[360px] bg-[#09090B]/95 backdrop-blur-3xl rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col transition-all duration-300 transform origin-bottom z-50 overflow-hidden",
          showChat ? "h-[65vh] md:h-[500px] scale-100 opacity-100" : "h-0 scale-95 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0 bg-white/[0.02]">
          <h3 className="font-bold text-white flex items-center gap-2 text-[15px]">
            <MessageCircle className="w-4 h-4 text-indigo-400" /> Room Chat
          </h3>
          <button onClick={() => setShowChat(false)} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full transition-colors active:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 pb-8">
              <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                <MessageCircle className="w-6 h-6 opacity-50 text-indigo-400" />
              </div>
              <span className="text-sm font-semibold tracking-wide">Say hi to the room!</span>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMe = msg.userId === user.id;
              return (
                <div key={i} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 px-1">{isMe ? "You" : msg.userName}</span>
                  <div className={cn(
                    "px-4 py-3 max-w-[85%] text-[14px] shadow-md font-medium",
                    isMe 
                      ? "bg-indigo-600 text-white rounded-2xl rounded-tr-sm" 
                      : "bg-white/10 text-white rounded-2xl rounded-tl-sm border border-white/5"
                  )}>
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={sendChat} className="p-4 border-t border-white/5 shrink-0 bg-black/40">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-[#000000] border border-white/10 focus:border-indigo-500/50 rounded-[1.25rem] px-5 py-3.5 text-[15px] outline-none text-white transition-all placeholder:text-gray-600 shadow-inner min-w-0"
            />
            <button 
              type="submit"
              disabled={!chatInput.trim()}
              className="w-14 shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-[1.25rem] transition-all shadow-lg flex items-center justify-center active:scale-95"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        </form>
      </div>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#09090B] rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
                <h3 className="font-bold text-white flex items-center gap-2 text-lg">
                  <Settings className="w-5 h-5 text-indigo-500" /> Audio Settings
                </h3>
                <button onClick={() => setShowSettings(false)} className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/5 active:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-6 space-y-8">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Call Volume</span>
                    <span className="text-[11px] text-indigo-400 font-mono bg-indigo-500/10 px-2 py-1 rounded-md">{Math.round(callVolume * 100)}%</span>
                  </label>
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-[1.5rem] border border-white/5">
                    <Volume2 className="w-5 h-5 text-gray-400 shrink-0" />
                    <input 
                      type="range" 
                      min="0" max="1" step="0.01" 
                      value={callVolume} 
                      onChange={(e) => setCallVolume(parseFloat(e.target.value))}
                      className="flex-1 accent-indigo-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Player Volume</span>
                    <span className="text-[11px] text-indigo-400 font-mono bg-indigo-500/10 px-2 py-1 rounded-md">{Math.round(playerVolume * 100)}%</span>
                  </label>
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-[1.5rem] border border-white/5">
                    <Volume2 className="w-5 h-5 text-gray-400 shrink-0" />
                    <input 
                      type="range" 
                      min="0" max="1" step="0.01" 
                      value={playerVolume} 
                      onChange={(e) => setPlayerVolume(parseFloat(e.target.value))}
                      className="flex-1 accent-indigo-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {audioOutputDevices.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-white/5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Call Output Device</label>
                    <div className="relative">
                      <select 
                        value={selectedAudioOutput} 
                        onChange={(e) => setSelectedAudioOutput(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 hover:border-white/20 rounded-[1.5rem] px-5 py-4 text-[15px] outline-none text-white transition-all appearance-none cursor-pointer font-medium"
                      >
                        {audioOutputDevices.map(device => (
                          <option key={device.deviceId} value={device.deviceId} className="bg-[#09090B] text-white">
                            {device.label || `Speaker ${device.deviceId.slice(0, 5)}...`}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ChevronLeft className="w-4 h-4 text-gray-400 -rotate-90" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
