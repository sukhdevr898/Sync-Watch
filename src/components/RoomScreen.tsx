import React, { useState, useEffect, useRef } from "react";
import { User, Message, VideoState } from "../types";
import { io, Socket } from "socket.io-client";
import ReactPlayer from "react-player";
import { Copy, ChevronLeft, Send, Users, Search, MessageCircle, Mic, MicOff, Video, VideoOff, SwitchCamera, X, AlertCircle, RefreshCw, Play, Volume2, Settings } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

const IS_DEV = (import.meta as any).env.MODE === "development";
const SOCKET_URL = undefined; // Let Socket.IO automatically use window.location

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
  const [activeTab, setActiveTab] = useState<"video-call" | "search">("video-call");
  
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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const playerRef = useRef<any>(null);
  const isSyncingRef = useRef(false);
  const lastStateUpdateRef = useRef(0);
  const ignoreNextTimeUpdateRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const pendingCandidates = useRef<any[]>([]);

  // Initialize Socket
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
      
      // If we are the first user (host) and someone else joins, send our current video state to sync them up
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
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      setupWebRTC(); // re-setup peer connection for next user
    });

    s.on("chat-message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.userId !== user.id) {
        setHasNewMessage(true);
      }
    });

    s.on("video-state", (state: VideoState) => {
      isSyncingRef.current = true;
      if (state.videoUrl !== undefined && state.videoUrl !== videoUrlRef.current) {
        setVideoUrl(state.videoUrl);
        setUrlInput(state.videoUrl);
        setPlayerError(false);
      }
      if (state.isPlaying !== undefined) setIsPlaying(state.isPlaying);
      if (state.currentTime !== undefined) {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const currentLocal = playerRef.current.getCurrentTime();
          if (Math.abs(currentLocal - state.currentTime) > 2) {
            playerRef.current.seekTo(state.currentTime, "seconds");
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

    s.on("webrtc-signal", async (data: { from: string; signal: any }) => {
      if (data.from === user.id) return; // Ignore our own signals just in case
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

  // Open Chat resets new message dot
  useEffect(() => {
    if (showChat) setHasNewMessage(false);
  }, [showChat]);

  // Attach video streams to elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.error("Local video play error:", e));
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      if (typeof (remoteVideoRef.current as any).setSinkId === "function" && selectedAudioOutput) {
        (remoteVideoRef.current as any).setSinkId(selectedAudioOutput).catch(console.error);
      }
      remoteVideoRef.current.volume = callVolume;
      remoteVideoRef.current.play().catch(e => console.error("Remote video play error:", e));
    }
  }, [remoteStream, selectedAudioOutput, callVolume]);

  // Initialize Media Devices & WebRTC
  const initMedia = async (deviceId?: string) => {
    try {
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
      
      // Keep mute/video state if previously toggled
      stream.getAudioTracks().forEach(t => (t.enabled = !isMuted));
      stream.getVideoTracks().forEach(t => (t.enabled = !isVideoOff));
      
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Enumerate cameras for switching
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");
      setCameraDevices(videoDevices);
      
      const audioOut = devices.filter(d => d.kind === "audiooutput");
      setAudioOutputDevices(audioOut);
      if (audioOut.length > 0 && !selectedAudioOutput) {
        setSelectedAudioOutput(audioOut[0].deviceId);
      }

      if (pcRef.current) {
        // Replace tracks in existing connection
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
      return stream;
    } catch (err) {
      console.error("Error accessing media devices.", err);
      // Fallback: Don't set a stream, or show a UI indicator
      // The app should still work for chatting and syncing videos without local media
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
    // Request media when tab is first selected, or component mounts if it's default
    initMedia().then((stream) => {
      if (!pcRef.current) setupWebRTC();
      if (socket) {
        socket.emit("join-room", { roomId, user });
      }
    });
  }, [socket]); // Run when socket is ready

  const emitVideoState = (state: VideoState, force = false) => {
    if (!socket || isSyncingRef.current) return;
    const now = Date.now();
    if (!force && now - lastStateUpdateRef.current < 300) return;
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

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => { track.enabled = isMuted; }); // isMuted true means currently muted, so we enable
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

  if (roomError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#06090e] p-6 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100/50 dark:bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Connection Error</h2>
        <p className="text-gray-500 dark:text-gray-400">{roomError}</p>
        <button onClick={onLeave} className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium mt-4 hover:opacity-90 transition-opacity">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen h-[100dvh] overflow-hidden bg-[#fcfcfc] dark:bg-[#06090e] text-gray-900 dark:text-white flex flex-col relative font-sans selection:bg-blue-500/30">
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="absolute top-20 left-1/2 z-50 pointer-events-none"
          >
            <div className="bg-black/80 dark:bg-white/90 backdrop-blur-md text-white dark:text-black px-4 py-2.5 rounded-full shadow-lg shadow-black/10 border border-white/10 dark:border-black/10 text-sm font-medium flex items-center gap-2">
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* HEADER */}
      <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-[#06090e]/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 shrink-0 z-10 sticky top-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onLeave} className="p-2.5 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">SyncRoom</span>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-mono bg-gray-100 dark:bg-gray-800/50 px-1.5 py-0.5 rounded uppercase tracking-wider">{roomId}</span>
              <button onClick={() => navigator.clipboard.writeText(roomId)} className="hover:text-gray-900 dark:hover:text-white transition-colors" title="Copy Room ID">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium border border-blue-100 dark:border-blue-500/20">
            <Users className="w-4 h-4" />
            <span>{users.length}/2</span>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="relative p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
            title="Audio Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowChat(!showChat)}
            className="relative p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
            title="Toggle Chat"
          >
            <MessageCircle className="w-5 h-5" />
            {hasNewMessage && !showChat && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping" />
            )}
            {hasNewMessage && !showChat && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-blue-500 border-2 border-white dark:border-gray-800 rounded-full" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full w-full overflow-hidden">
        {/* VIDEO PLAYER SECTION */}
        <div className="p-4 shrink-0">
          <div className="relative w-full aspect-video max-h-[45vh] mx-auto bg-black rounded-3xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-800">
            {videoUrl ? (
              playerError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white space-y-4 p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-red-500" />
                  <div>
                    <h3 className="text-xl font-bold mb-2">Video Failed to Load</h3>
                    <p className="text-gray-400 max-w-sm text-sm">
                      We couldn't load the video from the provided URL. It might be broken, private, or unsupported.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setPlayerError(false);
                      // Force remount of player by briefly removing URL
                      const url = videoUrl;
                      setVideoUrl("");
                      setTimeout(() => setVideoUrl(url), 100);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors font-medium text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry Loading
                  </button>
                </div>
              ) : (
                <div className="w-full h-full relative">
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
                    onProgress={(state: any) => {
                      if (ignoreNextTimeUpdateRef.current) {
                        ignoreNextTimeUpdateRef.current = false;
                        return;
                      }
                      // Optional continuous sync check
                    }}
                    onError={(e) => { 
                      console.error("Player Error:", e);
                      setPlayerError(true);
                    }}
                    config={{
                      youtube: {
                        playerVars: { origin: window.location.origin }
                      }
                    }}
                  />
                </div>
              )
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                <Play className="w-12 h-12 mb-2 opacity-20" />
                <p>No video loaded</p>
              </div>
            )}
          </div>
        </div>

        {/* TABS SECTION */}
        <div className="px-4 pb-4 flex-1 flex flex-col min-h-0">
          <div className="flex p-1 bg-gray-200/50 dark:bg-gray-800/50 rounded-xl mb-4 shrink-0">
            <button
              onClick={() => setActiveTab("video-call")}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                activeTab === "video-call" 
                  ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" 
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              Video Call
            </button>
            <button
              onClick={() => setActiveTab("search")}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                activeTab === "search" 
                  ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" 
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              Search & Load
            </button>
          </div>

          <div className="flex-1 min-h-0 bg-white dark:bg-[#101B2D] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
            {activeTab === "video-call" && (
              <div className="flex-1 flex items-center justify-center p-6 gap-6 h-full relative bg-gray-50/50 dark:bg-[#0A0F18]/50">
                {/* Local Video */}
                <div className="w-40 sm:w-64 aspect-video bg-gray-900 rounded-3xl overflow-hidden relative shadow-2xl ring-1 ring-white/10 dark:ring-white/5 transition-transform duration-300 hover:scale-[1.02]">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn("w-full h-full object-cover scale-x-[-1]", isVideoOff && "hidden")}
                  />
                  {isVideoOff && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800/90 backdrop-blur-sm">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-700 rounded-full flex items-center justify-center text-white text-lg font-bold uppercase shadow-inner border border-white/5">
                        {user.name.slice(0, 2)}
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-medium text-white shadow-sm border border-white/10 flex items-center gap-1.5">
                    You {isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                </div>

                {/* Remote Video */}
                <div className="w-40 sm:w-64 aspect-video bg-gray-900 rounded-3xl overflow-hidden relative shadow-2xl ring-1 ring-white/10 dark:ring-white/5 transition-transform duration-300 hover:scale-[1.02]">
                  {remoteStream ? (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs sm:text-sm flex-col bg-gray-900/50 backdrop-blur-sm">
                      <Users className="w-6 h-6 sm:w-8 sm:h-8 mb-2 opacity-30" />
                      <span className="text-center px-2 font-medium opacity-80">Waiting...</span>
                    </div>
                  )}
                  {users.find(u => u.id !== user.id) && (
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-medium text-white shadow-sm border border-white/10">
                      {users.find(u => u.id !== user.id)?.name}
                    </div>
                  )}
                </div>

                {/* Call Controls */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/90 dark:bg-[#111724]/90 backdrop-blur-xl px-5 py-3 rounded-full border border-gray-200/50 dark:border-gray-700/50 shadow-2xl">
                  <button onClick={toggleMute} className={cn("p-3.5 rounded-full transition-all duration-300 hover:scale-105", isMuted ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "bg-gray-100/80 hover:bg-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300")}>
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button onClick={toggleVideo} className={cn("p-3.5 rounded-full transition-all duration-300 hover:scale-105", isVideoOff ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "bg-gray-100/80 hover:bg-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300")}>
                    {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </button>
                  {cameraDevices.length > 1 && (
                    <button onClick={switchCamera} className="p-3.5 bg-gray-100/80 hover:bg-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-700 rounded-full transition-all duration-300 hover:scale-105 text-gray-700 dark:text-gray-300">
                      <SwitchCamera className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === "search" && (
              <div className="flex-1 flex flex-col p-6 h-full overflow-hidden">
                <form onSubmit={handleUrlSubmit} className="flex gap-3 mb-6 shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="Paste YouTube URL or search keywords..."
                      className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <button disabled={isSearching} type="submit" className="px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl text-sm font-semibold transition-colors shadow-sm">
                    {isSearching ? "Searching..." : "Load / Search"}
                  </button>
                </form>

                <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                  {searchResults.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {searchResults.map((video, index) => (
                        <button
                          key={`${video.id}-${index}`}
                          onClick={() => handleSelectVideo(video.url)}
                          className="w-full flex items-center gap-4 p-3 bg-gray-50/50 dark:bg-[#15233A]/50 hover:bg-white dark:hover:bg-[#1A2C47] rounded-2xl transition-all duration-300 text-left border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-md group"
                        >
                          <div className="relative w-36 aspect-video rounded-xl overflow-hidden shadow-sm shrink-0">
                            <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded shadow">
                              {video.duration}
                            </div>
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="w-8 h-8 text-white drop-shadow-md" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 py-1 flex flex-col justify-center">
                            <h4 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 leading-snug mb-1.5 group-hover:text-blue-500 transition-colors">{video.title}</h4>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{video.author}</p>
                          </div>
                        </button>
                      ))}
                      
                      {hasMoreSearch && (
                        <div className="pt-4 pb-2 flex justify-center">
                          <button 
                            onClick={handleLoadMore}
                            disabled={isSearching}
                            className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                          >
                            {isSearching ? "Loading..." : "Load More"}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4 text-gray-300 dark:text-gray-600">
                        <Search className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Search for videos to play together</p>
                      <p className="text-xs mt-1 opacity-70">Paste a YouTube link or type keywords</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CHAT OVERLAY */}
      <div 
        className={cn(
          "fixed bottom-4 right-4 w-80 md:w-[350px] bg-white/90 dark:bg-[#0A0F18]/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 dark:border-gray-800 flex flex-col transition-all duration-300 transform origin-bottom-right z-50",
          showChat ? "h-[500px] max-h-[80vh] scale-100 opacity-100" : "h-0 scale-90 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-800 shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm tracking-tight">
            <MessageCircle className="w-4 h-4 text-blue-500" /> Room Chat
          </h3>
          <button onClick={() => setShowChat(false)} className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
              Say hi to the room! 👋
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMe = msg.userId === user.id;
              return (
                <div key={i} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-1 px-1">{isMe ? "You" : msg.userName}</span>
                  <div className={cn(
                    "px-4 py-2.5 max-w-[85%] text-sm shadow-sm",
                    isMe 
                      ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm" 
                      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-tl-sm border border-gray-200/50 dark:border-gray-700/50"
                  )}>
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={sendChat} className="p-3 border-t border-gray-200/50 dark:border-gray-800 shrink-0 flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-50 dark:bg-[#111724] border border-gray-200/50 dark:border-gray-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900 dark:text-white transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button 
            type="submit"
            disabled={!chatInput.trim()}
            className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-all active:scale-95 shadow-sm disabled:active:scale-100 flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* SETTINGS OVERLAY */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-[#0A0F18] rounded-3xl shadow-2xl border border-gray-200/50 dark:border-gray-800 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm tracking-tight">
                <Settings className="w-4 h-4 text-blue-500" /> Audio Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Call Volume */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span>Call Volume</span>
                  <span className="text-xs text-gray-500">{Math.round(callVolume * 100)}%</span>
                </label>
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-gray-400" />
                  <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={callVolume} 
                    onChange={(e) => setCallVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-500 h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Player Volume */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span>Player Volume</span>
                  <span className="text-xs text-gray-500">{Math.round(playerVolume * 100)}%</span>
                </label>
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-gray-400" />
                  <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={playerVolume} 
                    onChange={(e) => setPlayerVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-500 h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Audio Output */}
              {audioOutputDevices.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800/50">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Call Output Device</label>
                  <select 
                    value={selectedAudioOutput} 
                    onChange={(e) => setSelectedAudioOutput(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-[#111724] border border-gray-200/50 dark:border-gray-700/50 rounded-xl px-4 py-3 text-sm outline-none text-gray-900 dark:text-white transition-all appearance-none"
                  >
                    {audioOutputDevices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Speaker ${device.deviceId.slice(0, 5)}...`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
