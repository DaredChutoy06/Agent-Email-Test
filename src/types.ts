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
  uid?: number;
  messageId?: string;
  unsubscribe?: UnsubscribeMetadata;
  sender?: {
    name: string;
    email: string;
  };
}

export interface UnsubscribeLink {
  kind: 'http' | 'mailto';
  value: string;
  source: 'list-unsubscribe' | 'body';
  oneClick: boolean;
}

export interface UnsubscribeMetadata {
  rawHeader?: string;
  postHeader?: string;
  oneClick: boolean;
  links: UnsubscribeLink[];
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
    keep: string[];
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
  lastUid?: number;
  readStateVersion?: number;
  emails: Email[];
}

export interface SenderRecord {
  email: string;
  name: string;
  totalEmails: number;
  unreadCount: number;
  readCount: number;
  firstEmailDate: Date;
  lastEmailDate: Date;
  lastSeen: Date;
}

export interface SenderDatabase {
  lastUpdated: Date;
  senders: SenderRecord[];
}
