import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Github, Layers, Terminal, Settings,
  Sparkles, Cpu, Network, User, LogOut, History, X,
  Wrench
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TaskInput } from '@/components/TaskInput';
import { StatusIndicator } from '@/components/StatusIndicator';
import { AgentCard } from '@/components/AgentCard';
import { ExecutionFlow } from '@/components/ExecutionFlow';
import { LogViewer } from '@/components/LogViewer';
import { ResultViewer } from '@/components/ResultViewer';
import { AuthModal } from '@/components/AuthModal';
import { TaskExecutor } from '@/components/TaskExecutor';
import { Orchestrator } from '@/services/orchestrator';
import * as api from '@/services/api';
import type { Task } from '@/types';

interface UserData {
  username: string;
  createdAt?: number;
}

function App() {
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [taskHistory, setTaskHistory] = useState<Task[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [useRealLLM, setUseRealLLM] = useState(true);

  const orchestrator = Orchestrator.getInstance();

  // Check for stored user on mount - use useSyncExternalStore pattern
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isInitialized) return;

    // Schedule state updates for next tick to avoid sync setState in effect
    const timer = setTimeout(() => {
      const storedUser = api.getStoredUser();
      if (storedUser) {
        setUser(storedUser);
      }

      // Load task history
      const allTasks = orchestrator.getAllTasks();
      setTaskHistory(allTasks);

      // Set LLM mode
      orchestrator.setUseRealLLM(useRealLLM);
      setIsInitialized(true);
    }, 0);

    return () => clearTimeout(timer);
  }, [isInitialized, orchestrator, useRealLLM]);

  // Subscribe to task updates
  useEffect(() => {
    const unsubscribe = orchestrator.subscribe((task) => {
      setCurrentTask(task);
      setIsProcessing(['pending', 'analyzing', 'planning', 'executing'].includes(task.status));

      // Update history
      setTaskHistory(orchestrator.getAllTasks());
    });

    return () => unsubscribe();
  }, [orchestrator]);

  const handleSubmitTask = useCallback(async (description: string) => {
    setIsProcessing(true);
    const task = await orchestrator.submitTask(description);
    setCurrentTask(task);
  }, [orchestrator]);

  const handleAuthSuccess = useCallback((userData: UserData) => {
    setUser(userData);
  }, []);

  const handleLogout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  const handleLoadTask = useCallback((task: Task) => {
    setCurrentTask(task);
    setShowHistory(false);
  }, []);

  const handleDeleteTask = useCallback(async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await orchestrator.deleteTask(taskId);
    setTaskHistory(orchestrator.getAllTasks());
    if (currentTask?.id === taskId) {
      setCurrentTask(null);
    }
  }, [orchestrator, currentTask?.id]);

  const toggleLLMMode = useCallback(() => {
    const newMode = !useRealLLM;
    setUseRealLLM(newMode);
    orchestrator.setUseRealLLM(newMode);
  }, [useRealLLM, orchestrator]);

  const completedAgents = currentTask?.agents.filter(a => a.status === 'completed').length || 0;
  const githubAgents = currentTask?.agents.filter(a => a.source === 'github').length || 0;
  const generatedAgents = currentTask?.agents.filter(a => a.source === 'generated').length || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600">
                <Network className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  AutoAgent System
                </h1>
                <p className="text-xs text-slate-500">
                  {useRealLLM ? 'Kimi K2.5 Powered' : 'Mock Mode'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* LLM Mode Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleLLMMode}
                className={`hidden sm:flex ${useRealLLM ? 'text-cyan-400' : 'text-slate-500'}`}
              >
                <Cpu className="h-4 w-4 mr-1" />
                {useRealLLM ? 'Kimi API' : 'Mock'}
              </Button>

              {/* History Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="hidden sm:flex text-slate-400 hover:text-slate-200"
              >
                <History className="h-4 w-4 mr-1" />
                History
              </Button>

              <div className="hidden md:flex items-center gap-2">
                <Badge variant="outline" className="border-slate-700 text-slate-400">
                  <Github className="h-3 w-3 mr-1" />
                  GitHub Discovery
                </Badge>
              </div>

              {/* User Menu */}
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800">
                    <User className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-300">{user.username}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-slate-200">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAuthModal(true)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <User className="h-4 w-4 mr-1" />
                  Login
                </Button>
              )}

              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Task History Sidebar */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="flex-shrink-0 overflow-hidden"
              >
                <div className="w-80 p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-200">Task History</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-[600px] overflow-auto">
                    {taskHistory.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">No tasks yet</p>
                    ) : (
                      taskHistory.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleLoadTask(task)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            currentTask?.id === task.id
                              ? 'bg-cyan-950 border border-cyan-800'
                              : 'bg-slate-800 hover:bg-slate-750 border border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <p className="text-sm text-slate-300 line-clamp-2 flex-1">{task.description}</p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 ml-2 text-slate-500 hover:text-red-400"
                              onClick={(e) => handleDeleteTask(task.id, e)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                task.status === 'completed'
                                  ? 'border-emerald-800 text-emerald-400'
                                  : task.status === 'error'
                                  ? 'border-red-800 text-red-400'
                                  : 'border-slate-700 text-slate-400'
                              }`}
                            >
                              {task.status}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {new Date(task.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content Area */}
          <div className="flex-1">
            {/* Hero Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-10"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-3">
                Describe Your Task.{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  We Handle the Rest.
                </span>
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto">
                Our system automatically decomposes your task, discovers or generates specialized agents,
                and orchestrates them in parallel to deliver results faster.
              </p>
            </motion.div>

            {/* Task Input */}
            <div className="mb-8">
              <TaskInput onSubmit={handleSubmitTask} isProcessing={isProcessing} />
            </div>

            {/* Status Indicator */}
            <AnimatePresence>
              {currentTask && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-8"
                >
                  <StatusIndicator task={currentTask} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Dashboard Tabs */}
            {currentTask && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Tabs defaultValue="agents" className="w-full">
                  <TabsList className="grid w-full grid-cols-5 bg-slate-900 border border-slate-800">
                    <TabsTrigger value="agents" className="data-[state=active]:bg-slate-800">
                      <Bot className="h-4 w-4 mr-2" />
                      Agents
                      {currentTask.agents.length > 0 && (
                        <Badge variant="secondary" className="ml-2 bg-slate-700">
                          {completedAgents}/{currentTask.agents.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="execution" className="data-[state=active]:bg-slate-800">
                      <Layers className="h-4 w-4 mr-2" />
                      Execution
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="data-[state=active]:bg-slate-800">
                      <Terminal className="h-4 w-4 mr-2" />
                      Logs
                      <Badge variant="secondary" className="ml-2 bg-slate-700">
                        {currentTask.logs.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="result" className="data-[state=active]:bg-slate-800">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Result
                    </TabsTrigger>
                    <TabsTrigger value="tools" className="data-[state=active]:bg-slate-800">
                      <Wrench className="h-4 w-4 mr-2" />
                      Tools
                    </TabsTrigger>
                  </TabsList>

                  {/* Agents Tab */}
                  <TabsContent value="agents" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-violet-950">
                            <Bot className="h-5 w-5 text-violet-400" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-slate-100">{currentTask.agents.length}</p>
                            <p className="text-sm text-slate-500">Total Agents</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-800">
                            <Github className="h-5 w-5 text-slate-300" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-slate-100">{githubAgents}</p>
                            <p className="text-sm text-slate-500">From GitHub</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-cyan-950">
                            <Sparkles className="h-5 w-5 text-cyan-400" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-slate-100">{generatedAgents}</p>
                            <p className="text-sm text-slate-500">Auto-Generated</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {currentTask.agents.map((agent, index) => (
                        <AgentCard key={agent.id} agent={agent} index={index} />
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="execution" className="mt-6">
                    <ExecutionFlow task={currentTask} />
                  </TabsContent>

                  <TabsContent value="logs" className="mt-6">
                    <LogViewer logs={currentTask.logs} />
                  </TabsContent>

                  <TabsContent value="result" className="mt-6">
                    {currentTask.result ? (
                      <ResultViewer result={currentTask.result} />
                    ) : (
                      <div className="text-center py-16">
                        <div className="p-4 rounded-full bg-slate-900 inline-block mb-4">
                          <Sparkles className="h-8 w-8 text-slate-600" />
                        </div>
                        <p className="text-slate-500">Result will appear here when the task is completed</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="tools" className="mt-6">
                    <TaskExecutor />
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}

            {/* Empty State */}
            {!currentTask && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-16"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    {
                      icon: Bot,
                      title: 'Auto-Generate Agents',
                      description: 'System automatically creates specialized agents based on task requirements.',
                      color: 'from-violet-500 to-purple-600',
                    },
                    {
                      icon: Github,
                      title: 'GitHub Discovery',
                      description: 'Searches GitHub for existing agent implementations to reuse.',
                      color: 'from-slate-500 to-slate-600',
                    },
                    {
                      icon: Layers,
                      title: 'Parallel Execution',
                      description: 'Orchestrates multiple agents in parallel for maximum efficiency.',
                      color: 'from-cyan-500 to-blue-600',
                    },
                  ].map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm"
                    >
                      <div className={`p-3 rounded-lg bg-gradient-to-br ${feature.color} w-fit mb-4`}>
                        <feature.icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-100 mb-2">{feature.title}</h3>
                      <p className="text-slate-400 text-sm">{feature.description}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-slate-600" />
              <span className="text-slate-500 text-sm">AutoAgent System</span>
            </div>
            <p className="text-slate-600 text-sm">
              Powered by Kimi K2.5 · Production Ready
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
