import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  User, 
  Server, 
  MapPin, 
  Heart, 
  Activity,
  Power, 
  RefreshCw, 
  Send, 
  Trash2, 
  Copy, 
  Search, 
  Check, 
  Sparkles,
  Command,
  BookOpen,
  Settings,
  Plus,
  Trash2 as Trash,
  Save,
  Sliders,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface BotPosition {
  x: number;
  y: number;
  z: number;
}

interface BotStatus {
  online: boolean;
  username: string;
  server: string;
  health: number | null;
  food: number | null;
  position: BotPosition | null;
}

interface LogEntry {
  time: string;
  type: string;
  text: string;
}

export default function App() {
  // States
  const [status, setStatus] = useState<BotStatus>({
    online: false,
    username: '-',
    server: '-',
    health: null,
    food: null,
    position: null
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'chat' | 'system' | 'error'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<'reconnect' | 'disconnect' | null>(null);
  
  interface AutoReply {
    trigger: string;
    response: string;
  }

  // New Config States
  const [activeTab, setActiveTab] = useState<'console' | 'config'>('console');
  const [configHost, setConfigHost] = useState('');
  const [configUsername, setConfigUsername] = useState('');
  const [configAuth, setConfigAuth] = useState('offline');
  const [configVersion, setConfigVersion] = useState('');
  const [configBrand, setConfigBrand] = useState('vanilla');
  const [configPassword, setConfigPassword] = useState('');
  const [configStartupCommands, setConfigStartupCommands] = useState<string[]>([]);
  const [configAutoReplies, setConfigAutoReplies] = useState<AutoReply[]>([]);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Refs
  const logsEndRef = useRef<HTMLDivElement>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);

  // Quick Chat suggestions
  const suggestions = [
    '/server sveco',
    '/list',
    '/help',
    '/coords',
    'halo bot',
    'semangat!'
  ];

  // Fetch bot status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  // Fetch bot config
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfigHost(data.host || '');
      setConfigUsername(data.username || '');
      setConfigAuth(data.auth || 'offline');
      setConfigVersion(data.version || '');
      setConfigBrand(data.brand || 'vanilla');
      setConfigPassword(data.password || '');
      setConfigStartupCommands(data.startupCommands || []);
      setConfigAutoReplies(data.autoReplies || []);
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  };

  // Poll status on mount
  useEffect(() => {
    fetchStatus();
    fetchConfig();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // SSE connection for live logs
  useEffect(() => {
    let eventSource: EventSource;

    const connectSSE = () => {
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = (event) => {
        try {
          const log: LogEntry = JSON.parse(event.data);
          
          // Apply log type categorization rules
          let logType = log.type;
          const text = log.text;
          
          if (logType === 'info' && text.includes(': ') && !text.startsWith('[') && !text.startsWith('◇')) {
            logType = 'chat';
          } else if (logType === 'info' && (text.startsWith('[✅]') || text.startsWith('[+]') || text.startsWith('[🔄]') || text.startsWith('[🎉]'))) {
            logType = 'system';
          }

          setLogs((prev) => {
            const newLog = { ...log, type: logType };
            // Max 400 logs kept in memory
            const updated = [...prev, newLog];
            return updated.slice(-400);
          });
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Error, reconnecting...', err);
        eventSource.close();
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();
    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Auto scroll to bottom when logs update
  useEffect(() => {
    if (autoScroll && terminalBodyRef.current) {
      terminalBodyRef.current.scrollTo({
        top: terminalBodyRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [logs, autoScroll]);

  // Send control command (reconnect / disconnect)
  const handleControl = async (action: 'reconnect' | 'disconnect') => {
    setActionLoading(action);
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        // Add artificial log to terminal
        const systemMessage = action === 'reconnect' ? 'Memicu aksi kontrol: RECONNECT' : 'Memicu aksi kontrol: DISCONNECT';
        setLogs(prev => [...prev, {
          time: new Date().toLocaleTimeString(),
          type: 'system',
          text: `[🔄] ${systemMessage}`
        }]);
        setTimeout(fetchStatus, 1500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  // Save Bot config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: configHost,
          username: configUsername,
          auth: configAuth,
          version: configVersion,
          brand: configBrand,
          password: configPassword,
          startupCommands: configStartupCommands,
          autoReplies: configAutoReplies
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        if (data.config) {
          setConfigHost(data.config.host || '');
          setConfigUsername(data.config.username || '');
          setConfigAuth(data.config.auth || 'offline');
          setConfigVersion(data.config.version || '');
          setConfigBrand(data.config.brand || 'vanilla');
          setConfigPassword(data.config.password || '');
          setConfigStartupCommands(data.config.startupCommands || []);
          setConfigAutoReplies(data.config.autoReplies || []);
        }
        setTimeout(fetchStatus, 3000);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleAddCommand = () => {
    setConfigStartupCommands([...configStartupCommands, '']);
  };

  const handleCommandChange = (index: number, val: string) => {
    const updated = [...configStartupCommands];
    updated[index] = val;
    setConfigStartupCommands(updated);
  };

  const handleRemoveCommand = (index: number) => {
    const updated = [...configStartupCommands];
    updated.splice(index, 1);
    setConfigStartupCommands(updated);
  };

  const handleAddAutoReply = () => {
    setConfigAutoReplies([...configAutoReplies, { trigger: '', response: '' }]);
  };

  const handleAutoReplyChange = (index: number, field: 'trigger' | 'response', val: string) => {
    const updated = [...configAutoReplies];
    updated[index] = { ...updated[index], [field]: val };
    setConfigAutoReplies(updated);
  };

  const handleRemoveAutoReply = (index: number) => {
    const updated = [...configAutoReplies];
    updated.splice(index, 1);
    setConfigAutoReplies(updated);
  };

  // Send chat message
  const handleSendChat = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const message = (customMsg !== undefined ? customMsg : chatInput).trim();
    if (!message) return;

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      if (data.success) {
        if (customMsg === undefined) setChatInput('');
      } else {
        setLogs(prev => [...prev, {
          time: new Date().toLocaleTimeString(),
          type: 'error',
          text: `Gagal mengirim pesan: ${data.error || 'Server error'}`
        }]);
      }
    } catch (err) {
      console.error(err);
      setLogs(prev => [...prev, {
        time: new Date().toLocaleTimeString(),
        type: 'error',
        text: 'Gagal menghubungi server dashboard!'
      }]);
    }
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Copy logs to clipboard
  const copyLogs = () => {
    const textToCopy = logs
      .filter(log => {
        if (filter === 'all') return true;
        return log.type === filter;
      })
      .map(log => `[${log.time}] [${log.type.toUpperCase()}] ${log.text}`)
      .join('\n');
    
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Filters logic
  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.type === filter;
    const matchesSearch = log.text.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#090f1d] text-[#e2e8f0] font-sans antialiased overflow-x-hidden relative">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-[#090f1d]/80 backdrop-blur-md px-[5%] py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg shadow-blue-500/25">
            <Command className="h-5 w-5 text-white" />
            <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 opacity-30 blur-sm -z-10 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-200 to-emerald-400">
              MINECRAFT BOT
            </h1>
            <p className="text-xs text-slate-400 font-medium">Sistem Pemantau & Kontrol Bot</p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-4">
          {/* Live Status Badge */}
          <Badge 
            variant="outline" 
            className={`px-3 py-1 flex items-center gap-2 rounded-full border-slate-800 bg-[#0f172a]/60 shadow-sm ${
              status.online 
                ? 'text-emerald-400 border-emerald-500/20' 
                : 'text-rose-400 border-rose-500/20'
            }`}
          >
            <span className={`relative flex h-2.5 w-2.5`}>
              {status.online && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                status.online ? 'bg-emerald-500' : 'bg-rose-500'
              }`}></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider">
              {status.online ? 'Online' : 'Offline'}
            </span>
          </Badge>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-950/60 p-1 border border-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('console')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'console'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              Console
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'config'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Konfigurasi
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-[5%] py-8 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        
        {/* Left Side: Cards */}
        <div className="flex flex-col gap-6">
          
          {/* Status Bot Card */}
          <Card className="border-slate-800 bg-[#0f172a]/50 backdrop-blur-md shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-40" />
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-slate-200 tracking-wider uppercase flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" />
                Status Bot
              </CardTitle>
              <CardDescription className="text-xs">Informasi real-time status fisik bot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              
              {/* Metadata Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800/50">
                  <div className="flex items-center gap-2.5 text-slate-400">
                    <User className="h-4 w-4 text-slate-500" />
                    <span>Username</span>
                  </div>
                  <span className="font-semibold text-slate-200">{status.username}</span>
                </div>
                <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800/50">
                  <div className="flex items-center gap-2.5 text-slate-400">
                    <Server className="h-4 w-4 text-slate-500" />
                    <span>Server</span>
                  </div>
                  <span className="font-semibold text-slate-200">{status.server}</span>
                </div>
                <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800/50">
                  <div className="flex items-center gap-2.5 text-slate-400">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    <span>Posisi</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-200">
                    {status.position 
                      ? `X:${status.position.x} Y:${status.position.y} Z:${status.position.z}` 
                      : '-'
                    }
                  </span>
                </div>
              </div>

              {/* Progress Bars for Health & Food */}
              <div className="space-y-4 pt-2">
                
                {/* Health Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500/20" />
                      Health
                    </span>
                    <span className="text-rose-400 font-semibold font-mono">
                      {status.health !== null ? `${Math.round(status.health)}/20` : '-'}
                    </span>
                  </div>
                  <div className="relative h-2 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800/30">
                    <div 
                      className="h-full bg-gradient-to-r from-rose-500 to-pink-500 shadow-[0_0_8px_rgba(239,68,68,0.4)] transition-all duration-500"
                      style={{ width: status.health !== null ? `${(status.health / 20) * 100}%` : '0%' }}
                    />
                  </div>
                </div>

                {/* Food Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      Food (Hunger)
                    </span>
                    <span className="text-amber-400 font-semibold font-mono">
                      {status.food !== null ? `${Math.round(status.food)}/20` : '-'}
                    </span>
                  </div>
                  <div className="relative h-2 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800/30">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.4)] transition-all duration-500"
                      style={{ width: status.food !== null ? `${(status.food / 20) * 100}%` : '0%' }}
                    />
                  </div>
                </div>

              </div>

            </CardContent>
          </Card>

          {/* Controls Bot Card */}
          <Card className="border-slate-800 bg-[#0f172a]/50 backdrop-blur-md shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-45" />
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-slate-200 tracking-wider uppercase flex items-center gap-2">
                <Power className="h-4 w-4 text-emerald-400" />
                Kontrol Bot
              </CardTitle>
              <CardDescription className="text-xs">Aksi cepat koneksi bot Minecraft</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={() => handleControl('reconnect')}
                disabled={actionLoading !== null}
                className="w-full border-slate-800 bg-slate-900/50 hover:bg-emerald-600 hover:text-white transition-all duration-200 text-xs font-semibold py-5 text-emerald-400"
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${actionLoading === 'reconnect' ? 'animate-spin' : ''}`} />
                Reconnect
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleControl('disconnect')}
                disabled={actionLoading !== null}
                className="w-full border-slate-800 bg-slate-900/50 hover:bg-rose-600 hover:text-white transition-all duration-200 text-xs font-semibold py-5 text-rose-400"
              >
                <Power className={`mr-2 h-3.5 w-3.5 ${actionLoading === 'disconnect' ? 'animate-spin' : ''}`} />
                Disconnect
              </Button>
            </CardContent>
          </Card>
          
        </div>

        {/* Right Side: Terminal Log & Input OR Config */}
        <div className="flex flex-col gap-4 h-[calc(100vh-140px)] min-h-[550px]">
          {activeTab === 'console' ? (
            <>
              {/* Terminal Console Card */}
              <Card className="flex-1 border-slate-800 bg-[#070a13]/95 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col relative">
                
                {/* Terminal Header */}
                <div className="px-4 py-3 bg-[#0f172a] border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Simulated Linux Dots */}
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <div className="h-4 w-[1px] bg-slate-800" />
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-400">
                      <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                      LIVE STREAM LOGS
                    </div>
                  </div>

                  {/* Utility Tools */}
                  <div className="flex items-center gap-2">
                    
                    {/* Search Log */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                      <Input 
                        placeholder="Cari kata kunci..." 
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        className="h-7 w-[160px] pl-8 text-[11px] bg-slate-950/80 border-slate-800 rounded-md text-slate-200 placeholder:text-slate-600 focus-visible:ring-blue-500"
                      />
                    </div>

                    <div className="h-6 w-[1px] bg-slate-800" />

                    {/* Copy logs */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={copyLogs}
                      title="Copy Logs"
                      className="h-7 w-7 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded"
                    >
                      {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>

                    {/* Clear console */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={clearLogs}
                      title="Clear Terminal"
                      className="h-7 w-7 text-slate-400 hover:text-rose-400 hover:bg-slate-800/50 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>

                    {/* Auto Scroll Toggle */}
                    <Button
                      variant="ghost"
                      onClick={() => setAutoScroll(!autoScroll)}
                      className={`h-7 px-2.5 text-[10px] font-mono rounded border border-slate-800 transition-colors ${
                        autoScroll 
                          ? 'bg-blue-950/40 text-blue-300 border-blue-800/30' 
                          : 'bg-slate-900/30 text-slate-500'
                      }`}
                    >
                      SCROLL: {autoScroll ? 'AUTO' : 'LOCK'}
                    </Button>

                  </div>
                </div>

                {/* Filter Tabs Header */}
                <div className="px-4 py-2 bg-[#090f1d] border-b border-slate-900 flex gap-1.5 overflow-x-auto scrollbar-none">
                  {(['all', 'chat', 'system', 'error'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFilter(tab)}
                      className={`px-3 py-1 text-[11px] font-mono font-semibold rounded uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                        filter === tab 
                          ? 'bg-slate-800 text-white shadow-sm' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab === 'all' ? 'Semua' : tab === 'chat' ? '💬 Chat' : tab === 'system' ? '⚙️ System' : '🚨 Error'}
                    </button>
                  ))}
                </div>

                {/* Terminal Body */}
                <div 
                  ref={terminalBodyRef}
                  className="flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed space-y-1.5 select-text bg-[#05080f]/95 scroll-smooth"
                >
                  {filteredLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center flex-col text-slate-600 gap-1.5 py-12">
                      <Terminal className="h-8 w-8 text-slate-800" />
                      <span className="text-xs">Tidak ada log yang cocok</span>
                    </div>
                  ) : (
                    filteredLogs.map((log, index) => {
                      let textClass = 'text-slate-300';
                      
                      if (log.type === 'error') {
                        textClass = 'text-rose-400 font-medium';
                      } else if (log.type === 'chat') {
                        textClass = 'text-emerald-400 font-medium';
                      } else if (log.type === 'system') {
                        textClass = 'text-sky-400 font-medium';
                      }

                      return (
                        <div key={index} className="flex items-start gap-2.5 group hover:bg-slate-950/20 px-1 py-0.5 rounded transition-all">
                          <span className="text-slate-600 select-none flex-shrink-0">
                            [{log.time}]
                          </span>
                          <span className={`${textClass} break-all whitespace-pre-wrap flex-1`}>
                            {log.text}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={logsEndRef} />
                </div>

              </Card>

              {/* Quick Chat Suggestions & Input Area */}
              <div className="space-y-2">
                
                {/* Quick Chips */}
                <div className="flex flex-wrap items-center gap-1.5 px-1 overflow-x-auto scrollbar-none">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500 flex items-center gap-1 mr-1">
                    <BookOpen className="h-3 w-3" />
                    Aksi Cepat:
                  </span>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendChat(undefined, suggestion)}
                      className="px-2.5 py-1 text-[10px] font-mono rounded-md bg-slate-900/60 border border-slate-800 hover:border-blue-500/30 hover:bg-blue-950/10 text-slate-300 transition-all duration-150 cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {/* Chat form */}
                <form onSubmit={handleSendChat} className="flex gap-2">
                  <Input 
                    placeholder="Ketik pesan atau perintah chat Minecraft (contoh: /server sveco)..."
                    value={chatInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatInput(e.target.value)}
                    autoComplete="off"
                    className="flex-1 bg-[#090f1d]/85 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500 h-11"
                  />
                  <Button 
                    type="submit" 
                    className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 font-semibold px-5 h-11 shadow-lg shadow-blue-500/15 active:scale-95 transition-all"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Kirim
                  </Button>
                </form>

              </div>
            </>
          ) : (
            /* Konfigurasi Bot Card */
            <Card className="flex-1 border-slate-800 bg-[#070a13]/95 backdrop-blur-md shadow-2xl overflow-y-auto flex flex-col p-6 scrollbar-none">
              <div className="border-b border-slate-800 pb-4 mb-6">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-blue-400" />
                  Konfigurasi Bot Minecraft
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Atur kredensial, versi game, dan perintah otomatis setelah login. Menyimpan konfigurasi akan me-restart bot secara otomatis.
                </p>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-6 flex-1 flex flex-col">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Host */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5 text-blue-400" />
                      SERVER HOST / IP
                    </label>
                    <Input
                      type="text"
                      placeholder="Contoh: marlinmc.icu"
                      value={configHost}
                      onChange={(e) => setConfigHost(e.target.value)}
                      className="bg-slate-950/80 border-slate-800 text-slate-200 focus-visible:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Username */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-blue-400" />
                      USERNAME
                    </label>
                    <Input
                      type="text"
                      placeholder="Contoh: Seranjanah"
                      value={configUsername}
                      onChange={(e) => setConfigUsername(e.target.value)}
                      className="bg-slate-950/80 border-slate-800 text-slate-200 focus-visible:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <Command className="h-3.5 w-3.5 text-blue-400" />
                      PASSWORD
                    </label>
                    <Input
                      type="text"
                      placeholder="Password login bot"
                      value={configPassword}
                      onChange={(e) => setConfigPassword(e.target.value)}
                      className="bg-slate-950/80 border-slate-800 text-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Version */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-blue-400" />
                      VERSI MINECRAFT
                    </label>
                    <Input
                      type="text"
                      placeholder="Contoh: 1.21.4"
                      value={configVersion}
                      onChange={(e) => setConfigVersion(e.target.value)}
                      className="bg-slate-950/80 border-slate-800 text-slate-200 focus-visible:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Auth Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-blue-400" />
                      TIPE AUTH
                    </label>
                    <select
                      value={configAuth}
                      onChange={(e) => setConfigAuth(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs shadow-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                    >
                      <option value="offline">Offline / Cracked</option>
                      <option value="microsoft">Microsoft / Premium</option>
                    </select>
                  </div>

                  {/* Client Brand */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-blue-400" />
                      CLIENT BRAND
                    </label>
                    <Input
                      type="text"
                      placeholder="Contoh: vanilla"
                      value={configBrand}
                      onChange={(e) => setConfigBrand(e.target.value)}
                      className="bg-slate-950/80 border-slate-800 text-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Startup Commands */}
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800/50 pb-2">
                    <label className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-blue-400" />
                      STARTUP COMMANDS (URUTAN EKSEKUSI)
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddCommand}
                      className="h-7 border-slate-800 bg-slate-900/50 hover:bg-blue-600 hover:text-white transition-all text-xs text-blue-400 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Tambah
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Perintah di bawah akan dijalankan otomatis dengan jeda 1.5 detik per baris setelah bot berhasil masuk ke lobby. Gunakan <code className="text-blue-400 font-semibold">{`{password}`}</code> sebagai placeholder otomatis untuk password yang diatur di atas.
                  </p>

                  <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                    {configStartupCommands.length === 0 ? (
                      <div className="text-center py-6 text-slate-600 text-xs border border-dashed border-slate-800/80 rounded-lg">
                        Tidak ada startup command. Bot hanya akan diam saat masuk.
                      </div>
                    ) : (
                      configStartupCommands.map((cmd, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-500 w-5 text-right">{idx + 1}.</span>
                          <Input
                            type="text"
                            placeholder="Contoh: /login {password} atau /server sveco"
                            value={cmd}
                            onChange={(e) => handleCommandChange(idx, e.target.value)}
                            className="bg-slate-950/80 border-slate-800 text-slate-200 focus-visible:ring-blue-500 flex-1 h-9"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveCommand(idx)}
                            className="h-9 w-9 text-slate-500 hover:text-rose-400 hover:bg-slate-800/30 rounded cursor-pointer"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Auto Replies */}
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800/50 pb-2">
                    <label className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
                      AUTO REPLY / AUTO LOGIN (DETEKSI CHAT SERVER)
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddAutoReply}
                      className="h-7 border-slate-800 bg-slate-900/50 hover:bg-blue-600 hover:text-white transition-all text-xs text-blue-400 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Tambah
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Bila bot mendeteksi chat/pesan dari server yang mengandung kata kunci pemicu, bot akan otomatis mengirim pesan balasan setelah jeda 1 detik. Gunakan <code className="text-blue-400 font-semibold">{`{password}`}</code> untuk menyertakan password secara otomatis.
                  </p>

                  <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                    {configAutoReplies.length === 0 ? (
                      <div className="text-center py-6 text-slate-600 text-xs border border-dashed border-slate-800/80 rounded-lg">
                        Tidak ada pemicu deteksi chat. Bot tidak akan membalas chat server secara otomatis.
                      </div>
                    ) : (
                      configAutoReplies.map((reply, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-500 w-5 text-right">{idx + 1}.</span>
                          <Input
                            type="text"
                            placeholder="Kata kunci pemicu (contoh: /login)"
                            value={reply.trigger}
                            onChange={(e) => handleAutoReplyChange(idx, 'trigger', e.target.value)}
                            className="bg-slate-950/80 border-slate-800 text-slate-200 focus-visible:ring-blue-500 flex-1 h-9"
                          />
                          <span className="text-xs text-slate-500 font-bold">➔</span>
                          <Input
                            type="text"
                            placeholder="Pesan balasan (contoh: /login {password})"
                            value={reply.response}
                            onChange={(e) => handleAutoReplyChange(idx, 'response', e.target.value)}
                            className="bg-slate-950/80 border-slate-800 text-slate-200 focus-visible:ring-blue-500 flex-1 h-9"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveAutoReply(idx)}
                            className="h-9 w-9 text-slate-500 hover:text-rose-400 hover:bg-slate-800/30 rounded cursor-pointer"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Submit area */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4 mt-auto">
                  <div className="text-xs text-slate-400">
                    {saveSuccess && (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5 animate-bounce">
                        <Check className="h-4 w-4" /> Konfigurasi disimpan! Bot sedang melakukan restart...
                      </span>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={isSavingConfig}
                    className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 font-semibold px-6 shadow-lg shadow-blue-500/15 transition-all cursor-pointer"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSavingConfig ? 'Menyimpan...' : 'Simpan & Reconnect'}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800 bg-[#05080e]/60 py-6 mt-12 text-center text-xs text-slate-500 font-medium">
        MinecraftBot Dashboard &copy; {new Date().getFullYear()} - Advanced Agentic Coding
      </footer>

    </div>
  );
}
