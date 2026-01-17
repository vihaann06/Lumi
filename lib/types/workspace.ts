// Core domain types

export interface Workspace {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Folder {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  agentConfig?: AgentConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentConfig {
  folderId: string;
  retrievalScope: 'strict' | 'relaxed'; // strict = only folder docs, relaxed = can use external
  citationStyle: 'inline' | 'footnote' | 'apa' | 'mla';
  tone?: string; // e.g., "academic", "casual", "professional"
}

