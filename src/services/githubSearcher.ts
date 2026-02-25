// GitHub Searcher - Search for existing agents and skills on GitHub

import type { Agent, Skill, GitHubRepo, Parameter } from '@/types';

export class GitHubSearcher {
  private static instance: GitHubSearcher;
  private cache: Map<string, GitHubRepo[]> = new Map();
  
  static getInstance(): GitHubSearcher {
    if (!GitHubSearcher.instance) {
      GitHubSearcher.instance = new GitHubSearcher();
    }
    return GitHubSearcher.instance;
  }

  /**
   * Search for agents on GitHub based on task description
   */
  async searchAgents(query: string, taskType: string): Promise<Agent[]> {
    const searchQueries = this.buildSearchQueries(query, taskType);
    const repos: GitHubRepo[] = [];
    
    for (const searchQuery of searchQueries) {
      const results = await this.searchGitHub(searchQuery);
      repos.push(...results);
    }
    
    // Remove duplicates and sort by relevance
    const uniqueRepos = this.deduplicateRepos(repos);
    const sortedRepos = this.sortByRelevance(uniqueRepos, taskType);
    
    // Convert top repos to agents
    const agents = await Promise.all(
      sortedRepos.slice(0, 5).map(repo => this.convertRepoToAgent(repo))
    );
    
    return agents.filter(a => a !== null) as Agent[];
  }

  /**
   * Search for specific skills on GitHub
   */
  async searchSkills(skillName: string): Promise<Skill[]> {
    const query = `topic:agent skill ${skillName} language:typescript OR language:python`;
    const repos = await this.searchGitHub(query);
    
    const skills: Skill[] = [];
    for (const repo of repos.slice(0, 3)) {
      const skill = await this.extractSkillFromRepo(repo, skillName);
      if (skill) {
        skills.push(skill);
      }
    }
    
    return skills;
  }

  private buildSearchQueries(taskDescription: string, taskType: string): string[] {
    const queries: string[] = [];
    
    // Main query with task type
    queries.push(`topic:ai-agent ${taskType} language:typescript stars:>10`);
    queries.push(`topic:llm-agent ${taskType} language:python stars:>10`);
    
    // Extract keywords from description
    const keywords = this.extractKeywords(taskDescription);
    if (keywords.length > 0) {
      queries.push(`topic:agent ${keywords.join(' ')} stars:>5`);
    }
    
    // Specific agent types
    const agentTypeQueries: Record<string, string[]> = {
      researcher: ['web-scraper', 'data-collector', 'search-agent'],
      analyst: ['data-analyzer', 'ml-agent', 'analytics'],
      writer: ['content-generator', 'writing-agent', 'llm-writer'],
      validator: ['testing-agent', 'validator', 'qa-agent'],
      developer: ['code-agent', 'programming-assistant', 'dev-agent'],
      scraper: ['web-scraper', 'crawler', 'data-extraction'],
      api_client: ['api-agent', 'http-client', 'rest-agent'],
    };
    
    const specificTypes = agentTypeQueries[taskType] || [];
    for (const type of specificTypes) {
      queries.push(`topic:${type} stars:>5`);
    }
    
    return queries;
  }

  private extractKeywords(description: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const words = description
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
    
    // Return unique keywords
    return [...new Set(words)].slice(0, 5);
  }

  private async searchGitHub(query: string): Promise<GitHubRepo[]> {
    // Check cache first
    const cacheKey = query.toLowerCase().replace(/\s+/g, '_');
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        // Return mock data if API fails
        return this.getMockRepos(query);
      }

      const data = await response.json() as { items: Array<Record<string, unknown>> };
      const repos: GitHubRepo[] = data.items.map((item: Record<string, unknown>) => ({
        id: item.id as number,
        name: item.name as string,
        fullName: item.full_name as string,
        description: (item.description as string) || '',
        url: item.html_url as string,
        stars: item.stargazers_count as number,
        language: (item.language as string) || 'Unknown',
        topics: (item.topics as string[]) || [],
      }));

      // Cache results
      this.cache.set(cacheKey, repos);
      
      return repos;
    } catch (error) {
      console.error('GitHub search error:', error);
      return this.getMockRepos(query);
    }
  }

  private getMockRepos(query: string): GitHubRepo[] {
    // Mock data for demonstration when API is unavailable
    const mockRepos: GitHubRepo[] = [
      {
        id: 1,
        name: 'ai-research-agent',
        fullName: 'example/ai-research-agent',
        description: 'An AI agent for automated research and data collection',
        url: 'https://github.com/example/ai-research-agent',
        stars: 1250,
        language: 'TypeScript',
        topics: ['ai-agent', 'research', 'automation'],
      },
      {
        id: 2,
        name: 'web-scraper-agent',
        fullName: 'example/web-scraper-agent',
        description: 'Intelligent web scraping agent with LLM capabilities',
        url: 'https://github.com/example/web-scraper-agent',
        stars: 890,
        language: 'Python',
        topics: ['web-scraper', 'agent', 'llm'],
      },
      {
        id: 3,
        name: 'data-analyzer-agent',
        fullName: 'example/data-analyzer-agent',
        description: 'Agent for analyzing and visualizing data',
        url: 'https://github.com/example/data-analyzer-agent',
        stars: 650,
        language: 'TypeScript',
        topics: ['data-analysis', 'agent', 'visualization'],
      },
      {
        id: 4,
        name: 'content-writer-agent',
        fullName: 'example/content-writer-agent',
        description: 'AI agent for generating high-quality content',
        url: 'https://github.com/example/content-writer-agent',
        stars: 520,
        language: 'Python',
        topics: ['content-generation', 'writing', 'agent'],
      },
      {
        id: 5,
        name: 'code-assistant-agent',
        fullName: 'example/code-assistant-agent',
        description: 'Programming assistant agent for code generation and review',
        url: 'https://github.com/example/code-assistant-agent',
        stars: 2100,
        language: 'TypeScript',
        topics: ['code-assistant', 'developer-tools', 'agent'],
      },
    ];

    // Filter based on query
    const queryTerms = query.toLowerCase().split(/\s+/);
    return mockRepos.filter(repo => {
      const repoText = `${repo.name} ${repo.description} ${repo.topics.join(' ')}`.toLowerCase();
      return queryTerms.some(term => repoText.includes(term.replace(/topic:|language:/g, '')));
    });
  }

  private deduplicateRepos(repos: GitHubRepo[]): GitHubRepo[] {
    const seen = new Set<string>();
    return repos.filter(repo => {
      if (seen.has(repo.fullName)) {
        return false;
      }
      seen.add(repo.fullName);
      return true;
    });
  }

  private sortByRelevance(repos: GitHubRepo[], taskType: string): GitHubRepo[] {
    return repos.sort((a, b) => {
      // Prioritize repos with matching topics
      const aTopicMatch = a.topics.some(t => t.includes(taskType)) ? 100 : 0;
      const bTopicMatch = b.topics.some(t => t.includes(taskType)) ? 100 : 0;
      
      // Consider stars
      const scoreA = a.stars + aTopicMatch;
      const scoreB = b.stars + bTopicMatch;
      
      return scoreB - scoreA;
    });
  }

  private async convertRepoToAgent(repo: GitHubRepo): Promise<Agent | null> {
    try {
      // Try to fetch README for more details
      const readme = await this.fetchReadme(repo.fullName);
      
      // Parse skills from README or description
      const skills = this.parseSkillsFromReadme(readme || repo.description);
      
      const agent: Agent = {
        id: `github_${repo.id}`,
        name: repo.name.replace(/-/g, '_').toUpperCase(),
        description: repo.description || `GitHub agent: ${repo.name}`,
        skills,
        status: 'idle',
        source: 'github',
        githubUrl: repo.url,
        language: repo.language.toLowerCase(),
        createdAt: Date.now(),
      };

      return agent;
    } catch (error) {
      console.error('Error converting repo to agent:', error);
      return null;
    }
  }

  private async fetchReadme(repoFullName: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/readme`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      // README content is base64 encoded
      const content = atob(data.content);
      return content;
    } catch {
      return null;
    }
  }

  private parseSkillsFromReadme(readme: string | null): Skill[] {
    if (!readme) {
      return [{
        id: 'default',
        name: 'execute',
        description: 'Execute agent functionality',
        parameters: [
          { name: 'input', type: 'unknown', description: 'Input data', required: true },
        ],
        returnType: 'unknown',
      }];
    }

    // Extract skills from README sections
    const skills: Skill[] = [];
    
    // Look for API/Usage sections
    const apiMatch = readme.match(/##\s*(?:API|Usage|Features)([\s\S]*?)(?=##|$)/i);
    if (apiMatch) {
      const methods = apiMatch[1].match(/[-*]\s*(\w+)\s*\([^)]*\)/g);
      if (methods) {
        for (const method of methods) {
          const match = method.match(/[-*]\s*(\w+)\s*\(([^)]*)\)/);
          if (match) {
            skills.push({
              id: match[1].toLowerCase(),
              name: match[1],
              description: `Function from ${match[1]}`,
              parameters: this.parseParameters(match[2]),
              returnType: 'any',
            });
          }
        }
      }
    }

    // If no skills found, add default
    if (skills.length === 0) {
      skills.push({
        id: 'default',
        name: 'execute',
        description: 'Execute agent functionality',
        parameters: [
          { name: 'input', type: 'any', description: 'Input data', required: true },
        ],
        returnType: 'unknown',
      });
    }

    return skills;
  }

  private parseParameters(paramString: string): Parameter[] {
    if (!paramString.trim()) {
      return [];
    }

    return paramString.split(',').map((param, index) => {
      const [name, type] = param.trim().split(':');
      return {
        name: name || `param${index}`,
        type: type || 'any',
        description: `Parameter ${name || index}`,
        required: !name?.includes('?'),
        defaultValue: undefined,
      };
    });
  }

  private async extractSkillFromRepo(repo: GitHubRepo, skillName: string): Promise<Skill | null> {
    // Try to extract specific skill from repo
    const readme = await this.fetchReadme(repo.fullName);
    
    if (readme) {
      const skillRegex = new RegExp(`##\\s*${skillName}([\\s\\S]*?)(?=##|$)`, 'i');
      const match = readme.match(skillRegex);
      
      if (match) {
        return {
          id: `${repo.name}_${skillName}`,
          name: skillName,
          description: match[1].trim().slice(0, 200),
          parameters: [
            { name: 'input', type: 'any', description: 'Input data', required: true },
          ],
          returnType: 'any',
        };
      }
    }

    return null;
  }
}

export default GitHubSearcher.getInstance();
