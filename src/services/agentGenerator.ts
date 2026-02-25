// Agent Generator - Automatically creates agents based on task requirements

import type { Agent, Skill, Parameter } from '@/types';

export class AgentGenerator {
  private static instance: AgentGenerator;
  
  static getInstance(): AgentGenerator {
    if (!AgentGenerator.instance) {
      AgentGenerator.instance = new AgentGenerator();
    }
    return AgentGenerator.instance;
  }

  /**
   * Generate an agent based on task description
   */
  async generateAgent(taskDescription: string, requirements: string[]): Promise<Agent> {
    const id = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Parse task to determine agent type and skills
    const agentType = this.determineAgentType(taskDescription);
    const skills = this.generateSkillsForType(agentType, requirements);
    
    // Generate agent code (JavaScript for sandbox execution)
    const code = this.generateAgentCode(id, agentType, skills);
    
    const agent: Agent = {
      id,
      name: this.generateAgentName(agentType),
      description: `Auto-generated agent for: ${taskDescription}`,
      skills,
      status: 'idle',
      code,
      language: 'javascript',
      source: 'generated',
      createdAt: Date.now(),
    };

    return agent;
  }

  /**
   * Generate multiple agents for a complex task
   */
  async generateAgents(_taskDescription: string, subTasks: string[]): Promise<Agent[]> {
    const agents: Agent[] = [];
    
    for (const subTask of subTasks) {
      const agent = await this.generateAgent(subTask, []);
      agents.push(agent);
    }
    
    return agents;
  }

  private determineAgentType(description: string): string {
    const lower = description.toLowerCase();
    
    if (lower.includes('search') || lower.includes('find') || lower.includes('fetch')) {
      return 'researcher';
    }
    if (lower.includes('analyze') || lower.includes('process') || lower.includes('compute')) {
      return 'analyst';
    }
    if (lower.includes('write') || lower.includes('generate') || lower.includes('create')) {
      return 'writer';
    }
    if (lower.includes('test') || lower.includes('verify') || lower.includes('check')) {
      return 'validator';
    }
    if (lower.includes('code') || lower.includes('program') || lower.includes('develop')) {
      return 'developer';
    }
    if (lower.includes('scrape') || lower.includes('crawl') || lower.includes('extract')) {
      return 'scraper';
    }
    if (lower.includes('api') || lower.includes('request') || lower.includes('call')) {
      return 'api_client';
    }
    
    return 'general';
  }

  private generateSkillsForType(agentType: string, requirements: string[]): Skill[] {
    const skillTemplates: Record<string, Skill[]> = {
      researcher: [
        {
          id: 'search_web',
          name: 'searchWeb',
          description: 'Search the web for information',
          parameters: [
            { name: 'query', type: 'string', description: 'Search query', required: true },
            { name: 'limit', type: 'number', description: 'Max results', required: false, defaultValue: 10 },
          ],
          returnType: 'SearchResult[]',
        },
        {
          id: 'summarize',
          name: 'summarize',
          description: 'Summarize found information',
          parameters: [
            { name: 'content', type: 'string', description: 'Content to summarize', required: true },
          ],
          returnType: 'string',
        },
      ],
      analyst: [
        {
          id: 'analyze_data',
          name: 'analyzeData',
          description: 'Analyze data and extract insights',
          parameters: [
            { name: 'data', type: 'any', description: 'Data to analyze', required: true },
            { name: 'metrics', type: 'string[]', description: 'Metrics to calculate', required: false },
          ],
          returnType: 'AnalysisResult',
        },
        {
          id: 'compare',
          name: 'compare',
          description: 'Compare multiple datasets',
          parameters: [
            { name: 'datasets', type: 'any[]', description: 'Datasets to compare', required: true },
          ],
          returnType: 'ComparisonResult',
        },
      ],
      writer: [
        {
          id: 'generate_text',
          name: 'generateText',
          description: 'Generate text content',
          parameters: [
            { name: 'prompt', type: 'string', description: 'Writing prompt', required: true },
            { name: 'style', type: 'string', description: 'Writing style', required: false, defaultValue: 'professional' },
          ],
          returnType: 'string',
        },
        {
          id: 'format_output',
          name: 'formatOutput',
          description: 'Format content for output',
          parameters: [
            { name: 'content', type: 'string', description: 'Content to format', required: true },
            { name: 'format', type: 'string', description: 'Output format', required: true },
          ],
          returnType: 'string',
        },
      ],
      validator: [
        {
          id: 'verify',
          name: 'verify',
          description: 'Verify output correctness',
          parameters: [
            { name: 'output', type: 'any', description: 'Output to verify', required: true },
            { name: 'criteria', type: 'string[]', description: 'Verification criteria', required: true },
          ],
          returnType: 'VerificationResult',
        },
        {
          id: 'test',
          name: 'test',
          description: 'Run tests on code or data',
          parameters: [
            { name: 'target', type: 'any', description: 'Target to test', required: true },
            { name: 'testCases', type: 'any[]', description: 'Test cases', required: false },
          ],
          returnType: 'TestResult',
        },
      ],
      developer: [
        {
          id: 'write_code',
          name: 'writeCode',
          description: 'Write code for a specific task',
          parameters: [
            { name: 'language', type: 'string', description: 'Programming language', required: true },
            { name: 'requirements', type: 'string', description: 'Code requirements', required: true },
          ],
          returnType: 'string',
        },
        {
          id: 'debug',
          name: 'debug',
          description: 'Debug existing code',
          parameters: [
            { name: 'code', type: 'string', description: 'Code to debug', required: true },
            { name: 'error', type: 'string', description: 'Error message', required: false },
          ],
          returnType: 'DebugResult',
        },
      ],
      scraper: [
        {
          id: 'scrape_web',
          name: 'scrapeWeb',
          description: 'Scrape data from websites',
          parameters: [
            { name: 'url', type: 'string', description: 'Target URL', required: true },
            { name: 'selectors', type: 'Record<string,string>', description: 'CSS selectors', required: true },
          ],
          returnType: 'ScrapedData',
        },
        {
          id: 'parse_html',
          name: 'parseHTML',
          description: 'Parse HTML content',
          parameters: [
            { name: 'html', type: 'string', description: 'HTML content', required: true },
          ],
          returnType: 'ParsedData',
        },
      ],
      api_client: [
        {
          id: 'make_request',
          name: 'makeRequest',
          description: 'Make HTTP API request',
          parameters: [
            { name: 'method', type: 'string', description: 'HTTP method', required: true },
            { name: 'url', type: 'string', description: 'API endpoint', required: true },
            { name: 'data', type: 'any', description: 'Request body', required: false },
          ],
          returnType: 'ApiResponse',
        },
        {
          id: 'handle_auth',
          name: 'handleAuth',
          description: 'Handle API authentication',
          parameters: [
            { name: 'type', type: 'string', description: 'Auth type', required: true },
            { name: 'credentials', type: 'any', description: 'Credentials', required: true },
          ],
          returnType: 'AuthToken',
        },
      ],
      general: [
        {
          id: 'execute',
          name: 'execute',
          description: 'Execute general task',
          parameters: [
            { name: 'task', type: 'string', description: 'Task description', required: true },
            { name: 'context', type: 'object', description: 'Execution context', required: false },
          ],
          returnType: 'unknown',
        },
      ],
    };

    const skills = skillTemplates[agentType] || skillTemplates.general;
    
    // Add requirement-based skills
    for (const req of requirements) {
      const customSkill = this.createSkillFromRequirement(req);
      if (customSkill) {
        skills.push(customSkill);
      }
    }
    
    return skills;
  }

  private createSkillFromRequirement(req: string): Skill | null {
    // Parse requirement and create appropriate skill
    const lower = req.toLowerCase();
    
    if (lower.includes('file')) {
      return {
        id: 'file_operation',
        name: 'fileOperation',
        description: 'Perform file operations',
        parameters: [
          { name: 'operation', type: 'string', description: 'Operation type', required: true },
          { name: 'path', type: 'string', description: 'File path', required: true },
          { name: 'content', type: 'string', description: 'File content', required: false },
        ],
        returnType: 'FileResult',
      };
    }
    
    if (lower.includes('database') || lower.includes('db')) {
      return {
        id: 'database_query',
        name: 'databaseQuery',
        description: 'Execute database queries',
        parameters: [
          { name: 'query', type: 'string', description: 'SQL query', required: true },
          { name: 'params', type: 'any[]', description: 'Query parameters', required: false },
        ],
        returnType: 'QueryResult',
      };
    }
    
    return null;
  }

  private generateAgentName(type: string): string {
    const prefixes: Record<string, string> = {
      researcher: 'Research',
      analyst: 'Analyst',
      writer: 'Writer',
      validator: 'Validator',
      developer: 'Dev',
      scraper: 'Scraper',
      api_client: 'API',
      general: 'Agent',
    };
    
    const prefix = prefixes[type] || 'Agent';
    const suffix = Math.random().toString(36).substr(2, 4).toUpperCase();
    
    return `${prefix}_${suffix}`;
  }

  // 生成纯 JavaScript 代码（供 sandbox 执行）
  private generateAgentCode(agentId: string, type: string, skills: Skill[]): string {
    const skillMethods = skills.map(skill => `
  /**
   * ${skill.description}
   */
  async ${skill.name}(${this.generateParametersJS(skill.parameters)}) {
    console.log('Executing ${skill.name}...');
    // Implementation
    ${this.generateImplementation(skill)}
  }`).join('\n');

    return `/**
 * Auto-generated Agent: ${agentId}
 * Type: ${type}
 */

class ${this.classNameFromId(agentId)} {
  constructor() {
    this.id = '${agentId}';
    this.type = '${type}';
    console.log('Agent ${agentId} initialized');
  }

${skillMethods}

  /**
   * Main execution entry point
   */
  async execute(input) {
    console.log('Agent executing task:', input);
    // Main execution logic
    return this.process(input);
  }

  async process(input) {
    // Processing logic based on agent type
    return { result: 'completed', agentId: this.id };
  }
}

module.exports = ${this.classNameFromId(agentId)};`;
  }

  // JavaScript 参数生成（不带类型声明）
  private generateParametersJS(params: Parameter[]): string {
    return params.map(p => {
      const optional = p.required ? '' : ' = null';
      const defaultVal = p.defaultValue !== undefined ? ` = ${JSON.stringify(p.defaultValue)}` : optional;
      return `${p.name}${defaultVal}`;
    }).join(', ');
  }

  private generateImplementation(skill: Skill): string {
    // Generate mock implementation based on skill type
    if (skill.name.includes('search')) {
      return `return [{ title: 'Result 1', url: 'https://example.com', snippet: '...' }];`;
    }
    if (skill.name.includes('analyze')) {
      return `return { insights: ['insight 1', 'insight 2'], metrics: {} };`;
    }
    if (skill.name.includes('generate') || skill.name.includes('write')) {
      return `return 'Generated content based on: ' + prompt;`;
    }
    if (skill.name.includes('scrape')) {
      return `return { data: {}, timestamp: Date.now() };`;
    }
    return `return { success: true, data: null };`;
  }

  private classNameFromId(id: string): string {
    return 'Agent_' + id.split('_')[1];
  }
}

export default AgentGenerator.getInstance();
