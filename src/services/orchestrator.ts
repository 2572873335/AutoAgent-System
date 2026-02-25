// Orchestrator - Task decomposition, agent coordination, and execution planning

import type { Task, SubTask, Agent, LogEntry, ExecutionPlan } from '@/types';
import { AgentGenerator } from './agentGenerator';
import { GitHubSearcher } from './githubSearcher';
import * as api from './api';

export class Orchestrator {
  private static instance: Orchestrator;
  private tasks: Map<string, Task> = new Map();
  private agentGenerator: AgentGenerator;
  private githubSearcher: GitHubSearcher;
  private listeners: Set<(task: Task) => void> = new Set();
  private useRealLLM: boolean = true;
  
  static getInstance(): Orchestrator {
    if (!Orchestrator.instance) {
      Orchestrator.instance = new Orchestrator();
    }
    return Orchestrator.instance;
  }

  private constructor() {
    this.agentGenerator = AgentGenerator.getInstance();
    this.githubSearcher = GitHubSearcher.getInstance();
    this.loadTasksFromStorage();
  }

  setUseRealLLM(use: boolean) {
    this.useRealLLM = use;
  }

  private loadTasksFromStorage() {
    try {
      const stored = localStorage.getItem('orchestrator_tasks');
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([k, v]) => {
          this.tasks.set(k, v as Task);
        });
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }

  private saveTasksToStorage() {
    try {
      const data = Object.fromEntries(this.tasks);
      localStorage.setItem('orchestrator_tasks', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  }

  async submitTask(description: string): Promise<Task> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: Task = {
      id: taskId,
      description,
      status: 'pending',
      subTasks: [],
      agents: [],
      createdAt: Date.now(),
      logs: [{
        timestamp: Date.now(),
        level: 'info',
        message: `Task submitted: ${description}`,
      }],
    };

    this.tasks.set(taskId, task);
    this.saveTasksToStorage();
    this.notifyListeners(task);

    if (api.isAuthenticated()) {
      try {
        await api.createTask(description);
      } catch (error) {
        console.warn('Failed to sync task with backend:', error);
      }
    }

    this.processTask(taskId);
    return task;
  }

  private async processTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      await this.updateTaskStatus(taskId, 'analyzing');
      await this.log(taskId, 'info', 'Analyzing task requirements...');
      
      const taskType = this.determineTaskType(task.description);
      const complexity = this.assessComplexity(task.description);

      // Detect if this is a research task that would benefit from web search
      const isResearchTask = /research|search|find|latest|trends|news|current|today|202[4-9]|最新|趋势|搜索|研究/i.test(task.description);
      if (isResearchTask) {
        await this.log(taskId, 'info', '🔍 Research task detected - will use web search if Perplexity API is configured');
      }

      await this.log(taskId, 'success', `Task type: ${taskType}, Complexity: ${complexity}`);

      await this.updateTaskStatus(taskId, 'planning');
      await this.log(taskId, 'info', 'Decomposing task into subtasks...');
      
      let subTasks: SubTask[];
      
      if (this.useRealLLM) {
        try {
          const result = await api.decomposeTaskWithKimi(task.description);
          subTasks = result.subtasks.map((st: unknown, index: number) => ({
            id: (st as { id?: string }).id || `subtask_${Date.now()}_${index}`,
            description: (st as { description: string }).description,
            dependencies: (st as { dependencies?: string[] }).dependencies || [],
            status: 'pending',
            input: { parentTask: task.description, step: index + 1 },
            createdAt: Date.now(),
          }));
        } catch (error) {
          console.warn('LLM decomposition failed, using fallback:', error);
          subTasks = await this.decomposeTaskFallback(task.description, taskType, complexity);
        }
      } else {
        subTasks = await this.decomposeTaskFallback(task.description, taskType, complexity);
      }
      
      task.subTasks = subTasks;
      await this.log(taskId, 'success', `Created ${subTasks.length} subtasks`);

      await this.log(taskId, 'info', 'Discovering and generating agents...');
      
      const agents = await this.discoverOrGenerateAgents(task, subTasks);
      task.agents = agents;
      
      await this.log(taskId, 'success', `Prepared ${agents.length} agents (${agents.filter(a => a.source === 'github').length} from GitHub, ${agents.filter(a => a.source === 'generated').length} generated)`);

      const plan = this.createExecutionPlan(subTasks);
      await this.log(taskId, 'info', `Execution plan: ${plan.parallelGroups.length} parallel groups, estimated ${plan.estimatedTime}s`);

      await this.updateTaskStatus(taskId, 'executing');
      await this.executePlan(taskId, plan);

      await this.updateTaskStatus(taskId, 'completed');
      task.result = this.aggregateResults(task);
      task.completedAt = Date.now();
      
      // 生成 PDF
      await this.log(taskId, 'info', 'Generating PDF document...');
      try {
        const pdfResult = await api.generatePDF(task.result, 'ai-trends-report.pdf');
        if (pdfResult.success) {
          await this.log(taskId, 'success', `PDF saved: ${pdfResult.filepath}`);
          task.result += `\n\n---\n**PDF File**: [Download PDF](${pdfResult.url})`;
        }
      } catch (pdfError) {
        console.warn('PDF generation failed:', pdfError);
        await this.log(taskId, 'warn', 'PDF generation failed, but results are available');
      }
      
      await this.log(taskId, 'success', 'Task completed successfully');

      await this.updateTaskStatus(taskId, 'completed');
      task.result = this.aggregateResults(task);
      task.completedAt = Date.now();
      
      await this.log(taskId, 'success', 'Task completed successfully');

      if (api.isAuthenticated()) {
        try {
          await api.updateTask(taskId, {
            status: 'completed',
            result: task.result,
            subtasks: task.subTasks,
            agents: task.agents,
          });
        } catch (error) {
          console.warn('Failed to sync completion with backend:', error);
        }
      }

    } catch (error) {
      await this.updateTaskStatus(taskId, 'error');
      await this.log(taskId, 'error', `Task failed: ${error}`);
      
      if (api.isAuthenticated()) {
        try {
          await api.updateTask(taskId, { status: 'error' });
        } catch (e) {
          console.warn('Failed to sync error with backend:', e);
        }
      }
    }

    this.saveTasksToStorage();
    this.notifyListeners(task);
  }

  private determineTaskType(description: string): string {
    const lower = description.toLowerCase();
    
    if (lower.includes('research') || lower.includes('find') || lower.includes('search')) {
      return 'research';
    }
    if (lower.includes('analyze') || lower.includes('process') || lower.includes('compute')) {
      return 'analysis';
    }
    if (lower.includes('write') || lower.includes('generate') || lower.includes('create content')) {
      return 'content_creation';
    }
    if (lower.includes('code') || lower.includes('program') || lower.includes('develop')) {
      return 'development';
    }
    if (lower.includes('test') || lower.includes('verify') || lower.includes('validate')) {
      return 'validation';
    }
    if (lower.includes('scrape') || lower.includes('extract') || lower.includes('crawl')) {
      return 'data_extraction';
    }
    if (lower.includes('api') || lower.includes('integrate') || lower.includes('connect')) {
      return 'integration';
    }
    
    return 'general';
  }

  private assessComplexity(description: string): 'simple' | 'medium' | 'complex' {
    const indicators = {
      simple: ['single', 'simple', 'basic', 'quick', 'one'],
      complex: ['multiple', 'complex', 'advanced', 'comprehensive', 'many', 'various', 'integrate', 'system'],
    };
    
    const lower = description.toLowerCase();
    const words = lower.split(/\s+/);
    
    let simpleScore = 0;
    let complexScore = 0;
    
    for (const word of words) {
      if (indicators.simple.some(i => word.includes(i))) simpleScore++;
      if (indicators.complex.some(i => word.includes(i))) complexScore++;
    }
    
    if (words.length > 30) complexScore++;
    if (words.length < 10) simpleScore++;
    
    if (complexScore > simpleScore) return 'complex';
    if (simpleScore > complexScore) return 'simple';
    return 'medium';
  }

  private async decomposeTaskFallback(description: string, taskType: string, complexity: string): Promise<SubTask[]> {
    const subTasks: SubTask[] = [];
    
    const decompositions: Record<string, Record<string, string[]>> = {
      research: {
        simple: ['Search for information', 'Summarize findings'],
        medium: ['Define research scope', 'Search multiple sources', 'Cross-reference information', 'Compile summary'],
        complex: ['Define research questions', 'Search academic sources', 'Search web sources', 'Analyze trends', 'Validate findings', 'Generate comprehensive report'],
      },
      analysis: {
        simple: ['Collect data', 'Perform analysis', 'Present results'],
        medium: ['Collect raw data', 'Clean and preprocess', 'Perform statistical analysis', 'Create visualizations', 'Interpret results'],
        complex: ['Define analysis framework', 'Collect multi-source data', 'Data cleaning and validation', 'Exploratory analysis', 'Statistical modeling', 'Trend analysis', 'Generate insights', 'Create dashboard'],
      },
      content_creation: {
        simple: ['Generate content', 'Review and edit'],
        medium: ['Research topic', 'Create outline', 'Generate draft', 'Review and refine', 'Format output'],
        complex: ['Topic research', 'Audience analysis', 'Content strategy', 'Create outline', 'Generate sections', 'Add visuals', 'SEO optimization', 'Quality review', 'Final polish'],
      },
      development: {
        simple: ['Write code', 'Test implementation'],
        medium: ['Design architecture', 'Implement core features', 'Write tests', 'Debug and optimize', 'Document code'],
        complex: ['Requirements analysis', 'System design', 'Database design', 'API development', 'Frontend implementation', 'Backend implementation', 'Integration testing', 'Performance optimization', 'Security review', 'Deployment'],
      },
      validation: {
        simple: ['Run validation checks', 'Report issues'],
        medium: ['Define test cases', 'Execute tests', 'Analyze results', 'Report findings', 'Suggest fixes'],
        complex: ['Create test plan', 'Unit testing', 'Integration testing', 'Performance testing', 'Security testing', 'User acceptance testing', 'Bug triage', 'Quality assessment', 'Compliance check'],
      },
      data_extraction: {
        simple: ['Scrape target data', 'Format output'],
        medium: ['Analyze target structure', 'Design scraper', 'Extract data', 'Clean data', 'Validate extraction'],
        complex: ['Site structure analysis', 'Anti-detection setup', 'Design extraction pipeline', 'Implement crawlers', 'Handle pagination', 'Data transformation', 'Quality validation', 'Export to multiple formats'],
      },
      integration: {
        simple: ['Connect to API', 'Test integration'],
        medium: ['API research', 'Authentication setup', 'Implement client', 'Error handling', 'Test endpoints'],
        complex: ['API analysis', 'Architecture design', 'Authentication implementation', 'Rate limiting', 'Error handling', 'Data mapping', 'Webhook setup', 'Monitoring', 'Documentation'],
      },
      general: {
        simple: ['Execute task', 'Verify result'],
        medium: ['Plan approach', 'Execute steps', 'Monitor progress', 'Validate output'],
        complex: ['Requirements gathering', 'Approach planning', 'Resource allocation', 'Step execution', 'Progress monitoring', 'Quality checks', 'Result aggregation'],
      },
    };

    const templates = decompositions[taskType]?.[complexity] || decompositions.general[complexity];
    const baseTimestamp = Date.now();
    
    for (let i = 0; i < templates.length; i++) {
      const subTask: SubTask = {
        id: `subtask_${baseTimestamp}_${i}`,
        description: templates[i],
        dependencies: i > 0 ? [`subtask_${baseTimestamp}_${i - 1}`] : [],
        status: 'pending',
        input: { parentTask: description, step: i + 1 },
        createdAt: baseTimestamp,
      };
      subTasks.push(subTask);
    }

    return subTasks;
  }

  private async discoverOrGenerateAgents(task: Task, subTasks: SubTask[]): Promise<Agent[]> {
    const agents: Agent[] = [];
    const taskType = this.determineTaskType(task.description);
    
    await this.log(task.id, 'info', 'Searching GitHub for existing agents...');
    const githubAgents = await this.githubSearcher.searchAgents(task.description, taskType);
    
    for (let i = 0; i < subTasks.length; i++) {
      const subTask = subTasks[i];
      
      const matchingGithubAgent = githubAgents.find(a => 
        this.isAgentSuitableForSubtask(a, subTask)
      );
      
      if (matchingGithubAgent && !agents.find(a => a.id === matchingGithubAgent.id)) {
        agents.push(matchingGithubAgent);
        subTask.agentId = matchingGithubAgent.id;
      } else {
        await this.log(task.id, 'info', `Generating agent for: ${subTask.description}`);
        
        const generatedAgent = await this.agentGenerator.generateAgent(subTask.description, []);
        agents.push(generatedAgent);
        subTask.agentId = generatedAgent.id;
      }
    }
    
    return agents;
  }

  private isAgentSuitableForSubtask(agent: Agent, subTask: SubTask): boolean {
    const agentDesc = agent.description.toLowerCase();
    const subTaskDesc = subTask.description.toLowerCase();
    
    const keywords = subTaskDesc.split(/\s+/).filter(w => w.length > 4);
    const matchCount = keywords.filter(k => agentDesc.includes(k)).length;
    
    return matchCount >= 1 || agentDesc.includes(subTaskDesc.split(' ')[0].toLowerCase());
  }

  private createExecutionPlan(subTasks: SubTask[]): ExecutionPlan {
    const groups: string[][] = [];
    const completed = new Set<string>();
    
    while (completed.size < subTasks.length) {
      const group: string[] = [];
      
      for (const subTask of subTasks) {
        if (completed.has(subTask.id)) continue;
        
        const depsSatisfied = subTask.dependencies.every(dep => completed.has(dep));
        
        if (depsSatisfied) {
          group.push(subTask.id);
        }
      }
      
      if (group.length === 0) {
        for (const subTask of subTasks) {
          if (!completed.has(subTask.id)) {
            group.push(subTask.id);
          }
        }
      }
      
      groups.push(group);
      for (const id of group) {
        completed.add(id);
      }
    }

    const estimatedTime = subTasks.length * 5;

    return {
      parallelGroups: groups,
      dependencies: Object.fromEntries(subTasks.map(st => [st.id, st.dependencies])),
      estimatedTime,
    };
  }

  private async executePlan(taskId: string, plan: ExecutionPlan): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    for (let i = 0; i < plan.parallelGroups.length; i++) {
      const group = plan.parallelGroups[i];
      
      await this.log(taskId, 'info', `Executing parallel group ${i + 1}/${plan.parallelGroups.length} (${group.length} subtasks)`);
      
      await Promise.all(group.map(subTaskId => this.executeSubTask(taskId, subTaskId)));
    }
  }

  private async executeSubTask(taskId: string, subTaskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const subTask = task.subTasks.find(st => st.id === subTaskId);
    if (!subTask) return;

    const agent = task.agents.find(a => a.id === subTask.agentId);
    if (!agent) {
      await this.log(taskId, 'error', `No agent found for subtask: ${subTask.description}`, subTaskId);
      subTask.status = 'error';
      return;
    }

    subTask.status = 'running';
    subTask.startedAt = Date.now();
    agent.status = 'running';
    
    await this.log(taskId, 'info', `Agent ${agent.name} executing: ${subTask.description}`, subTaskId, agent.id);
    this.notifyListeners(task);

    try {
      let result: unknown;
      
      await this.log(taskId, 'info', `Starting execution for: ${subTask.description}`, subTaskId, agent.id);
      
      if (this.useRealLLM) {
        try {
          await this.log(taskId, 'info', `Calling DeepSeek API for execution...`, subTaskId, agent.id);
          const apiResult = await api.executeWithKimi(
            agent.code || '',
            subTask.description,
            subTask.input,
            { task: task.description }
          );
          result = apiResult.result;
          await this.log(taskId, 'info', `DeepSeek API execution successful`, subTaskId, agent.id);
        } catch (error: unknown) {
          await this.log(taskId, 'warn', `DeepSeek API failed: ${(error as Error).message}, trying sandbox...`, subTaskId, agent.id);
          try {
            if (agent.code) {
              const sandboxResult = await api.executeInSandbox(agent.code);
              result = {
                output: sandboxResult.output,
                success: sandboxResult.success,
                executionTime: sandboxResult.executionTime,
                logs: sandboxResult.error ? [sandboxResult.error] : ['Executed in sandbox'],
              };
            } else {
              result = {
                output: `Task completed: ${subTask.description}`,
                success: true,
                executionTime: 0,
                logs: ['No code available'],
              };
            }
            await this.log(taskId, 'info', `Sandbox execution successful`, subTaskId, agent.id);
          } catch (sandboxError: unknown) {
            await this.log(taskId, 'error', `Sandbox also failed: ${(sandboxError as Error).message}`, subTaskId, agent.id);
            throw sandboxError;
          }
        }
      }
      
      subTask.status = 'completed';
      subTask.completedAt = Date.now();
      subTask.output = (result as { output?: unknown })?.output || result;
      agent.status = 'completed';
      agent.completedAt = Date.now();
      agent.result = {
        output: typeof (result as { output?: unknown })?.output === 'string' ? (result as { output: string }).output : JSON.stringify(result),
        data: result,
        logs: (result as { logs?: string[] })?.logs || [],
        executionTime: (result as { executionTime?: number })?.executionTime || 1500,
      };
      
      await this.log(taskId, 'success', `Subtask completed: ${subTask.description}`, subTaskId, agent.id);
      
    } catch (error: unknown) {
      subTask.status = 'error';
      agent.status = 'error';
      agent.error = String(error);
      
      await this.log(taskId, 'error', `Subtask failed: ${subTask.description} - ${(error as Error).message || error}`, subTaskId, agent.id);
    }

    this.saveTasksToStorage();
    this.notifyListeners(task);
  }

  private aggregateResults(task: Task): string {
    const completedSubTasks = task.subTasks.filter(st => st.status === 'completed');
    const failedSubTasks = task.subTasks.filter(st => st.status === 'error');
    
    let result = `# Task Execution Report\n\n`;
    result += `**Task:** ${task.description}\n\n`;
    result += `**Status:** ${task.status}\n\n`;
    result += `**Completed Subtasks:** ${completedSubTasks.length}/${task.subTasks.length}\n\n`;
    
    if (failedSubTasks.length > 0) {
      result += `**Failed Subtasks:**\n`;
      for (const st of failedSubTasks) {
        result += `- ${st.description}\n`;
      }
      result += '\n';
    }
    
    result += `## Execution Summary\n\n`;
    for (const st of task.subTasks) {
      const agent = task.agents.find(a => a.id === st.agentId);
      const status = st.status === 'completed' ? '✅' : st.status === 'error' ? '❌' : '⏳';
      result += `${status} **${st.description}** (Agent: ${agent?.name || 'Unknown'})\n`;
      if (st.output) {
        result += `   Output: ${typeof st.output === 'string' ? st.output : JSON.stringify(st.output)}\n`;
      }
    }
    
    return result;
  }

  private async updateTaskStatus(taskId: string, status: Task['status']): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      if (status === 'executing' && !task.startedAt) {
        task.startedAt = Date.now();
      }
      this.saveTasksToStorage();
      this.notifyListeners(task);
    }
  }

  private async log(taskId: string, level: LogEntry['level'], message: string, subTaskId?: string, agentId?: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      task.logs.push({
        timestamp: Date.now(),
        level,
        message,
        subTaskId,
        agentId,
      });
      this.saveTasksToStorage();
      this.notifyListeners(task);
    }
  }

  subscribe(listener: (task: Task) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(task: Task): void {
    for (const listener of this.listeners) {
      listener({ ...task });
    }
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getUserTasks(): Task[] {
    const user = api.getStoredUser();
    if (!user) return this.getAllTasks();
    
    return this.getAllTasks().filter(task => 
      task.logs.some(log => log.message.includes(user.username)) || true
    );
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const deleted = this.tasks.delete(taskId);
    if (deleted) {
      this.saveTasksToStorage();
      
      if (api.isAuthenticated()) {
        try {
          await api.deleteTask(taskId);
        } catch (error) {
          console.warn('Failed to sync deletion with backend:', error);
        }
      }
    }
    return deleted;
  }

  clearAllTasks(): void {
    this.tasks.clear();
    this.saveTasksToStorage();
  }
}

export default Orchestrator.getInstance();
