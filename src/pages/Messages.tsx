import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  Search, 
  User, 
  MoreVertical, 
  Phone, 
  Video, 
  Info,
  ChevronLeft,
  Loader2,
  Check,
  CheckCheck,
  Clock,
  Plus,
  X
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  doc,
  serverTimestamp, 
  orderBy,
  limit,
  getDocs,
  setDoc,
  deleteField
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Markdown from 'react-markdown';
import { getAiResponse, aiBotParticipant } from '../services/aiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  senderEmail: string;
  senderName: string;
  text: string;
  timestamp: any;
  readBy?: Record<string, any>;
  isAiGenerated?: boolean;
}

interface Conversation {
  id: string;
  participants: string[];
  participantsData: Record<string, { name: string; role: string; photoURL?: string }>;
  lastMessage?: string;
  lastMessageTimestamp?: any;
  typing?: Record<string, any>;
  isAiBot?: boolean;
  createdAt: any;
}

export default function Messages() {
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const targetEmail = searchParams.get('with');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [otherUserStatus, setOtherUserStatus] = useState<{ isOnline: boolean; lastSeen: any; typingTo: string | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout| null>(null);

  // Fetch conversations
  useEffect(() => {
    if (!profile?.email) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', profile.email),
      orderBy('lastMessageTimestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Conversation[];

      setConversations(convs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.email]);

  // Sync selected chat if it updates in the background
  useEffect(() => {
    if (selectedChat) {
      const updated = conversations.find(c => c.id === selectedChat.id);
      if (updated) setSelectedChat(updated);
    }
  }, [conversations]);

  // Search for users to start a new chat
  useEffect(() => {
    if (!userSearchQuery.trim() || !profile?.role) {
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      setSearchingUsers(true);
      try {
        const targetRole = profile.role === 'Patient' ? 'Doctor' : 'Patient';
        const q = query(
          collection(db, 'users'),
          where('role', '==', targetRole)
        );
        const snapshot = await getDocs(q);
        const results = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((u: any) => 
            u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
          );
        setSearchResults(results);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setSearchingUsers(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [userSearchQuery, profile?.role]);

  const handleStartNewChat = async (user: any) => {
    // Check if conversation already exists
    const existing = conversations.find(c => 
      c.participants.includes(user.email) && !c.isAiBot
    );

    if (existing) {
      setSelectedChat(existing);
    } else {
      // Create a localized temporary conversation object
      const convId = [profile!.email, user.email].sort().join('_');
      const newConv: Omit<Conversation, 'id'> = {
        participants: [profile!.email, user.email],
        participantsData: {
          [profile!.email]: { name: profile!.name || 'Me', role: profile!.role || 'User' },
          [user.email]: { name: user.name || user.email.split('@')[0], role: user.role || 'User' }
        },
        createdAt: serverTimestamp(),
        lastMessageTimestamp: serverTimestamp()
      };

      try {
        // We setDoc with merge to avoid overwriting if it exists but wasn't in state
        await setDoc(doc(db, 'conversations', convId), newConv, { merge: true });
        setSelectedChat({ id: convId, ...newConv } as Conversation);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'conversations');
      }
    }
    setShowNewChatModal(false);
    setUserSearchQuery('');
  };

  const startAiBotChat = async () => {
    if (!profile?.email) return;
    
    // Check if AI Bot conversation exists
    const existing = conversations.find(c => c.isAiBot);
    
    if (existing) {
      setSelectedChat(existing);
    } else {
      const convId = `ai_bot_${profile.email}`;
      const newConv: Omit<Conversation, 'id'> = {
        participants: [profile.email, aiBotParticipant.email],
        participantsData: {
          [profile.email]: { name: profile.name || 'Me', role: profile.role || 'User' },
          [aiBotParticipant.email]: { name: aiBotParticipant.name, role: aiBotParticipant.role }
        },
        isAiBot: true,
        createdAt: serverTimestamp(),
        lastMessageTimestamp: serverTimestamp(),
        lastMessage: "Hello! I'm your Health AI Bot. How can I help you today?"
      };

      try {
        await setDoc(doc(db, 'conversations', convId), newConv);
        // Add welcome message
        await addDoc(collection(db, 'conversations', convId, 'messages'), {
          text: newConv.lastMessage,
          senderEmail: aiBotParticipant.email,
          senderName: aiBotParticipant.name,
          timestamp: serverTimestamp(),
          isAiGenerated: true
        });
        setSelectedChat({ id: convId, ...newConv } as Conversation);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'conversations');
      }
    }
    setShowNewChatModal(false);
  };

  // Handle "with" query param
  useEffect(() => {
    if (targetEmail && profile?.email && conversations.length >= 0) {
      const existing = conversations.find(c => c.participants.includes(targetEmail) && !c.isAiBot);
      if (existing) {
        setSelectedChat(existing);
      } else {
        const fetchUser = async () => {
          const q = query(collection(db, 'users'), where('email', '==', targetEmail), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            handleStartNewChat(snap.docs[0].data());
          }
        };
        fetchUser();
      }
    }
  }, [targetEmail, profile?.email]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!profile?.email || !selectedChat) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'conversations', selectedChat.id, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      setMessages(msgs);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `conversations/${selectedChat.id}/messages`);
    });

    return () => unsubscribe();
  }, [profile?.email, selectedChat?.id]);

  // Listen for other user's status
  useEffect(() => {
    if (!selectedChat || selectedChat.isAiBot) {
      setOtherUserStatus(null);
      return;
    }

    const otherEmail = selectedChat.participants.find(e => e !== profile?.email);
    if (!otherEmail) return;

    const q = query(collection(db, 'users'), where('email', '==', otherEmail), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setOtherUserStatus({
          isOnline: data.isOnline || false,
          lastSeen: data.lastSeen,
          typingTo: data.typingTo || null
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${otherEmail}`);
    });

    return () => unsubscribe();
  }, [selectedChat?.id, profile?.email]);

  // Mark messages as read and update read receipts
  useEffect(() => {
    if (!profile?.email || !selectedChat || messages.length === 0) return;

    const unreadMessages = messages.filter(
      msg => msg.senderEmail !== profile.email && (!msg.readBy || !msg.readBy[profile.email!])
    );

    if (unreadMessages.length > 0) {
      unreadMessages.forEach(async (msg) => {
        try {
          await updateDoc(doc(db, 'conversations', selectedChat.id, 'messages', msg.id), {
            [`readBy.${profile.email!.replace(/\./g, '_')}`]: serverTimestamp()
          });
        } catch (error) {
          console.error("Error marking message as read:", error);
        }
      });
    }
  }, [messages, profile?.email, selectedChat?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !profile?.email || sending) return;

    const textPayload = newMessage.trim();
    setNewMessage('');
    setSending(true);
    
    // Clear typing status
    try {
      await updateDoc(doc(db, 'conversations', selectedChat.id), {
        [`typing.${profile.email.replace(/\./g, '_')}`]: deleteField()
      });
    } catch (e) {}

    try {
      // Add message
      const msgRef = await addDoc(collection(db, 'conversations', selectedChat.id, 'messages'), {
        senderEmail: profile.email,
        senderName: profile.name || profile.email.split('@')[0],
        text: textPayload,
        timestamp: serverTimestamp(),
        readBy: {
          [profile.email.replace(/\./g, '_')]: serverTimestamp()
        }
      });

      // Update conversation
      await updateDoc(doc(db, 'conversations', selectedChat.id), {
        lastMessage: textPayload,
        lastMessageTimestamp: serverTimestamp()
      });

      // AI Bot Logic
      if (selectedChat.isAiBot) {
        setIsAiTyping(true);
        // Show bot as typing in the DB
        try {
          await updateDoc(doc(db, 'conversations', selectedChat.id), {
            [`typing.${aiBotParticipant.email.replace(/\./g, '_')}`]: serverTimestamp()
          });
        } catch (e) {}

        const history = messages.slice(-10).map(m => ({
          role: m.senderEmail === aiBotParticipant.email ? 'model' : 'user' as any,
          content: m.text
        }));
        
        const aiResponse = await getAiResponse(textPayload, history);
        
        // Add AI message
        await addDoc(collection(db, 'conversations', selectedChat.id, 'messages'), {
          text: aiResponse,
          senderEmail: aiBotParticipant.email,
          senderName: aiBotParticipant.name,
          timestamp: serverTimestamp(),
          isAiGenerated: true,
          readBy: {
            [aiBotParticipant.email.replace(/\./g, '_')]: serverTimestamp(),
            [profile.email.replace(/\./g, '_')]: serverTimestamp() // Mark as read by me instantly since I'm here
          }
        });

        // Update conversation with AI response
        await updateDoc(doc(db, 'conversations', selectedChat.id), {
          lastMessage: aiResponse.slice(0, 50) + (aiResponse.length > 50 ? '...' : ''),
          lastMessageTimestamp: serverTimestamp(),
          [`typing.${aiBotParticipant.email.replace(/\./g, '_')}`]: deleteField()
        });
        
        setIsAiTyping(false);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `conversations/${selectedChat.id}/messages`);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (!profile?.email || !selectedChat) return;

    const updateTypingStatus = async (isTyping: boolean) => {
      try {
        const emailKey = profile.email!.replace(/\./g, '_');
        // Update both the conversation and the user document
        const promises = [
          updateDoc(doc(db, 'conversations', selectedChat.id), {
            [`typing.${emailKey}`]: isTyping ? serverTimestamp() : deleteField()
          }),
          updateDoc(doc(db, 'users', user!.uid), {
            typingTo: isTyping ? (selectedChat.isAiBot ? 'vitalis_ai' : targetEmail || selectedChat.participants.find(p => p !== profile.email)) : null
          })
        ];
        await Promise.all(promises);
      } catch (error) {
        console.error("Error updating typing status:", error);
      }
    };

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    updateTypingStatus(true);

    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 3000);
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex gap-6 overflow-hidden">
      {/* Sidebar */}
      <div className={cn(
        "w-full md:w-80 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col overflow-hidden transition-all",
        selectedChat && "hidden md:flex"
      )}>
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Messages</h2>
            <button 
              onClick={() => setShowNewChatModal(true)}
              className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {conversations.filter(c => {
            const otherEmail = c.participants.find(e => e !== profile?.email);
            const otherName = c.participantsData[otherEmail || '']?.name || 'User';
            return otherName.toLowerCase().includes(searchQuery.toLowerCase());
          }).length > 0 ? (
            conversations
              .filter(c => {
                const otherEmail = c.participants.find(e => e !== profile?.email);
                const otherName = c.participantsData[otherEmail || '']?.name || 'User';
                return otherName.toLowerCase().includes(searchQuery.toLowerCase());
              })
              .map((conv) => {
                const otherEmail = conv.participants.find(e => e !== profile?.email);
                const otherData = conv.participantsData[otherEmail || ''];
                // Count unread (not exact but a good proxy)
                const unread = false; // Simplified for now as we don't have unread count in conv doc easily
                
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedChat(conv)}
                    className={cn(
                      "w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-all border-b border-slate-50",
                      selectedChat?.id === conv.id && "bg-emerald-50/50 border-emerald-100"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center font-bold shrink-0",
                      conv.isAiBot ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
                    )}>
                      {conv.isAiBot ? "AI" : (otherData?.name?.[0]?.toUpperCase() || "U")}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <h4 className="font-bold text-slate-800 truncate">
                          {conv.isAiBot ? "Health AI Bot" : (otherData?.name || otherEmail)}
                        </h4>
                        {conv.lastMessageTimestamp && (
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            {new Date(conv.lastMessageTimestamp?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-slate-500 truncate font-medium flex-1">{conv.lastMessage || "No messages yet"}</p>
                      </div>
                    </div>
                  </button>
                );
              })
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="text-slate-800 font-bold">No messages yet</p>
                <p className="text-xs text-slate-500">Start a conversation with a doctor from the Doctors page.</p>
              </div>
              <button 
                onClick={() => navigate('/doctors')}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all"
              >
                Find Doctors
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className={cn(
        "flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col overflow-hidden transition-all",
        !selectedChat && "hidden md:flex"
      )}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md z-10">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedChat(null)}
                  className="md:hidden p-2 hover:bg-slate-50 rounded-xl text-slate-400"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center font-bold",
                  selectedChat.isAiBot ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                )}>
                  {selectedChat.isAiBot ? "AI" : (
                    selectedChat.participantsData[selectedChat.participants.find(e => e !== profile?.email)!]?.name?.[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 tracking-tight">
                    {selectedChat.isAiBot ? "Health AI Bot" : selectedChat.participantsData[selectedChat.participants.find(e => e !== profile?.email)!]?.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    {selectedChat.isAiBot ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bot Always Active</span>
                      </>
                    ) : (
                      <>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          otherUserStatus?.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                        )} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {otherUserStatus?.isOnline ? 'Online' : (
                            otherUserStatus?.lastSeen 
                              ? `Last seen ${new Date(otherUserStatus.lastSeen.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : selectedChat.participantsData[selectedChat.participants.find(e => e !== profile?.email)!]?.role
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-3 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                  <Phone className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => navigate('/consultation')}
                  className="p-3 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"
                >
                  <Video className="w-5 h-5" />
                </button>
                <button className="p-3 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                  <Info className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/30">
              <div className="flex justify-center mb-6">
                <div className="bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    Secure messaging for non-urgent queries. In case of emergency, call 911.
                  </p>
                </div>
              </div>

              {messages.map((msg, idx) => {
                const isMe = msg.senderEmail === profile?.email;
                const otherEmail = selectedChat.participants.find(e => e !== profile?.email);
                const isReadByOther = otherEmail && msg.readBy && msg.readBy[otherEmail.replace(/\./g, '_')];
                
                return (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "flex flex-col",
                      isMe ? "items-end" : "items-start"
                    )}
                  >
                    <div className={cn(
                      "max-w-[85%] p-4 rounded-2xl text-sm font-medium shadow-sm transition-all",
                      isMe 
                        ? "bg-emerald-600 text-white rounded-tr-none" 
                        : "bg-white text-slate-700 border border-slate-100 rounded-tl-none",
                      msg.isAiGenerated && "border-amber-100 bg-amber-50/30"
                    )}>
                      {msg.isAiGenerated ? (
                        <div className="markdown-body prose prose-sm prose-slate max-w-none">
                          <Markdown
                           components={{
                             p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                             ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                             ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                             li: ({ children }) => <li className="mb-0.5">{children}</li>,
                             strong: ({ children }) => <strong className="font-black text-amber-900">{children}</strong>,
                             h1: ({ children }) => <h1 className="text-lg font-black mb-2">{children}</h1>,
                             h2: ({ children }) => <h2 className="text-base font-black mb-1.5">{children}</h2>,
                             h3: ({ children }) => <h3 className="text-sm font-black mb-1">{children}</h3>,
                           }}
                          >
                            {msg.text}
                          </Markdown>
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>
                    <div className={cn(
                      "flex items-center gap-1.5 mt-1 px-1",
                      isMe ? "flex-row-reverse" : "flex-row"
                    )}>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">
                        {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                      </span>
                      {isMe && (
                        isReadByOther ? (
                          <CheckCheck className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Check className="w-3 h-3 text-slate-300" />
                        )
                      )}
                    </div>
                  </div>
                );
              })}
              
              {(() => {
                const otherEmail = selectedChat.participants.find(e => e !== profile?.email);
                const isTyping = (otherEmail && selectedChat.typing && selectedChat.typing[otherEmail.replace(/\./g, '_')]) || (selectedChat.isAiBot && isAiTyping);
                
                if (isTyping) {
                  return (
                    <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="bg-white text-slate-400 border border-slate-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                        <span className="text-[10px] font-black ml-1 uppercase tracking-widest text-emerald-500">
                          {selectedChat.isAiBot ? "Vitalis is thinking..." : "Typing..."}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              
              <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-6 bg-white border-t border-slate-100">
              <div className="relative flex items-center gap-4">
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={handleTyping}
                    placeholder="Type a message..."
                    className="w-full pl-6 pr-14 py-4 bg-slate-50 rounded-2xl border border-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button type="button" className="p-2 text-slate-400 hover:text-slate-600 transition-all">
                      <Clock className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
            <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
              <MessageSquare className="w-16 h-16" />
            </div>
            <div className="max-w-xs space-y-2">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Select a conversation</h3>
              <p className="text-slate-500 font-medium">Choose a chat from the sidebar to start messaging with your healthcare provider.</p>
            </div>
          </div>
        )}
      </div>
      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800">New Message</h3>
                <button onClick={() => setShowNewChatModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder={profile?.role === 'Patient' ? "Search doctors..." : "Search patients..."}
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
                  <button
                    onClick={startAiBotChat}
                    className="w-full flex items-center gap-3 p-3 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all text-left group border border-amber-100"
                  >
                    <div className="w-10 h-10 bg-amber-200 rounded-xl flex items-center justify-center text-amber-700 font-black text-sm">
                      AI
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-900">Health AI Bot</p>
                      <p className="text-[10px] text-amber-700 font-medium italic">Instant answers for your health queries</p>
                    </div>
                  </button>

                  <div className="h-px bg-slate-100 my-2" />

                  {searchingUsers ? (
                    <div className="py-8 text-center">
                      <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((user) => (
                      <button
                        key={user.email}
                        onClick={() => handleStartNewChat(user)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-all text-left group"
                      >
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-black text-sm group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all">
                          {user.name?.[0].toUpperCase() || user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{user.name || user.email.split('@')[0]}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{user.email}</p>
                        </div>
                      </button>
                    ))
                  ) : userSearchQuery ? (
                    <p className="py-8 text-center text-sm text-slate-500 font-medium">No users found.</p>
                  ) : (
                    <p className="py-8 text-center text-sm text-slate-400 font-medium italic">
                      Type to search for {profile?.role === 'Patient' ? "doctors" : "patients"}...
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
