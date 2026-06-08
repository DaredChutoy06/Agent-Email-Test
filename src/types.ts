// Email data structure
export interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: Date;
  body: string;
  isRead: boolean;
  timestamp: number;
  folder: string;
  sender?: {
    name: string;
    email: string;
  };
}

// Email analysis result
export interface EmailAnalysis {
  sender: string;
  totalEmails: number;
  unreadCount: number;
  lastEmailDate: Date;
  isRepetitive: boolean;
  averageDaysFrequency: number;
  readRate: number;
  recommendation: 'keep' | 'delete' | 'unsubscribe' | 'review';
  confidence: number;
  reason: string;
}

// Sub-agent analysis result
export interface SubAgentAnalysis {
  analyses: EmailAnalysis[];
  timestamp: Date;
  totalEmailsScanned: number;
  recommendedActions: {
    delete: string[];
    unsubscribe: string[];
    review: string[];
  };
  summary: string;
}

// iCloud Connection Config
export interface iCloudConfig {
  email: string;
  password: string;
}

// Email storage structure
export interface EmailStorage {
  lastScan: Date;
  emails: Email[];
}
