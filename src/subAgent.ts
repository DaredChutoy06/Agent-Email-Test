import Anthropic from '@anthropic-ai/sdk';
import { Email, EmailAnalysis, SubAgentAnalysis } from './types';

export class EmailAnalysisAgent {
  private client: Anthropic;
  private model = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-6';
  private fallbackModels = ['claude-haiku-4-5-20251001'];
  
  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey
    });
  }

  /**
   * Analyze emails to identify repetitive, unread patterns
   */
  async analyzeEmails(emails: Email[]): Promise<SubAgentAnalysis> {
    // Group emails by sender
    const senderGroups = this.groupEmailsBySender(emails);
    
    // Create analysis data for the agent
    const analysisData = Object.entries(senderGroups).map(([sender, emailList]) => ({
      sender,
      totalEmails: emailList.length,
      unreadCount: emailList.filter(e => !e.isRead).length,
      lastEmailDate: emailList[emailList.length - 1].date,
      firstEmailDate: emailList[0].date,
      subjects: [...new Set(emailList.map(e => e.subject))].slice(0, 5),
      averageDaysFrequency: this.calculateAverageFrequency(emailList),
      readRate: (emailList.filter(e => e.isRead).length / emailList.length) * 100
    }));

    // Send to Claude for analysis
    const prompt = this.buildAnalysisPrompt(analysisData);
    
    try {
      const message = await this.callAnthropic(prompt);
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const parsedAnalysis = this.parseAnalysisResponse(responseText, analysisData);

      return {
        analyses: parsedAnalysis,
        timestamp: new Date(),
        totalEmailsScanned: emails.length,
        recommendedActions: this.categorizeRecommendations(parsedAnalysis),
        summary: this.generateSummary(parsedAnalysis)
      };
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw error;
    }
  }

  private async callAnthropic(prompt: string) {
    let lastError: any = null;

    console.log(`[DEBUG] Env ANTHROPIC_MODEL=${process.env.ANTHROPIC_MODEL}`);
    console.log(`[DEBUG] Resolved model=${this.model}`);
    console.log(`[DEBUG] Fallback models=${JSON.stringify(this.fallbackModels)}`);

    for (const model of [this.model, ...this.fallbackModels]) {
      try {
        console.log(`[DEBUG] Trying Anthropic model: ${model}`);
        const message = await this.client.messages.create({
          model,
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });
        return message;
      } catch (error: any) {
        lastError = error;
        if (error?.status === 404) {
          console.warn(`[WARN] Model not found: ${model}`);
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Group emails by sender
   */
  private groupEmailsBySender(emails: Email[]): Record<string, Email[]> {
    const groups: Record<string, Email[]> = {};

    emails.forEach(email => {
      const sender = email.sender?.email || email.from;
      if (!groups[sender]) {
        groups[sender] = [];
      }
      groups[sender].push(email);
    });

    // Sort by most recent
    Object.keys(groups).forEach(sender => {
      groups[sender].sort((a, b) => b.timestamp - a.timestamp);
    });

    return groups;
  }

  /**
   * Calculate average days between emails from a sender
   */
  private calculateAverageFrequency(emails: Email[]): number {
    if (emails.length <= 1) return 0;

    const sortedEmails = emails.sort((a, b) => a.timestamp - b.timestamp);
    let totalDays = 0;
    
    for (let i = 1; i < sortedEmails.length; i++) {
      const daysDiff = (sortedEmails[i].timestamp - sortedEmails[i - 1].timestamp) / (1000 * 60 * 60 * 24);
      totalDays += daysDiff;
    }

    return Math.round((totalDays / (sortedEmails.length - 1)) * 10) / 10;
  }

  /**
   * Build the analysis prompt for Claude
   */
  private buildAnalysisPrompt(analysisData: any[]): string {
    return `You are an email analysis expert. Analyze the following email senders and their patterns to identify which ones should be deleted or unsubscribed from.

Email Sender Analysis:
${JSON.stringify(analysisData, null, 2)}

For each sender, provide a JSON response in this exact format:
{
  "analyses": [
    {
      "sender": "sender@example.com",
      "recommendation": "delete|unsubscribe|keep|review",
      "confidence": 0.0-1.0,
      "reason": "explanation"
    }
  ]
}

Consider these factors when making recommendations:
1. Unread/ignored emails: High unread count + low read rate = likely delete/unsubscribe
2. Frequency patterns: Emails received regularly but never opened = unsubscribe
3. Sender type: Marketing/promotional emails with no engagement = unsubscribe
4. Content patterns: Repetitive subject lines = likely spam/newsletter
5. Engagement: If user reads emails regularly, recommend "keep"

Provide ONLY valid JSON, no other text.`;
  }

  /**
   * Parse Claude's response
   */
  private parseAnalysisResponse(responseText: string, senderData: any[]): EmailAnalysis[] {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('No JSON found in response, using fallback analysis');
        return this.generateFallbackAnalysis(senderData);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return parsed.analyses.map((analysis: any) => ({
        sender: analysis.sender,
        totalEmails: senderData.find((sd: any) => sd.sender === analysis.sender)?.totalEmails || 0,
        unreadCount: senderData.find((sd: any) => sd.sender === analysis.sender)?.unreadCount || 0,
        lastEmailDate: senderData.find((sd: any) => sd.sender === analysis.sender)?.lastEmailDate || new Date(),
        isRepetitive: analysis.recommendation === 'unsubscribe' || analysis.recommendation === 'delete',
        averageDaysFrequency: senderData.find((sd: any) => sd.sender === analysis.sender)?.averageDaysFrequency || 0,
        readRate: senderData.find((sd: any) => sd.sender === analysis.sender)?.readRate || 0,
        recommendation: analysis.recommendation,
        confidence: analysis.confidence,
        reason: analysis.reason
      }));
    } catch (error) {
      console.error('Error parsing response:', error);
      return this.generateFallbackAnalysis(senderData);
    }
  }

  /**
   * Generate fallback analysis if Claude parsing fails
   */
  private generateFallbackAnalysis(senderData: any[]): EmailAnalysis[] {
    return senderData.map(sender => {
      const readRate = sender.readRate;
      const unreadCount = sender.unreadCount;
      const frequency = sender.averageDaysFrequency;

      let recommendation: 'keep' | 'delete' | 'unsubscribe' | 'review' = 'review';
      let confidence = 0.5;

      // Simple heuristic logic
      if (readRate < 20 && unreadCount > sender.totalEmails * 0.5) {
        recommendation = 'delete';
        confidence = 0.8;
      } else if (readRate < 40 && frequency < 3) {
        recommendation = 'unsubscribe';
        confidence = 0.7;
      } else if (readRate > 80) {
        recommendation = 'keep';
        confidence = 0.9;
      }

      return {
        sender: sender.sender,
        totalEmails: sender.totalEmails,
        unreadCount: unreadCount,
        lastEmailDate: sender.lastEmailDate,
        isRepetitive: recommendation !== 'keep',
        averageDaysFrequency: frequency,
        readRate,
        recommendation,
        confidence,
        reason: `Based on ${readRate.toFixed(1)}% read rate and ${frequency} days average frequency`
      };
    });
  }

  /**
   * Categorize recommendations
   */
  private categorizeRecommendations(analyses: EmailAnalysis[]) {
    return {
      delete: analyses.filter(a => a.recommendation === 'delete').map(a => a.sender),
      unsubscribe: analyses.filter(a => a.recommendation === 'unsubscribe').map(a => a.sender),
      review: analyses.filter(a => a.recommendation === 'review').map(a => a.sender)
    };
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(analyses: EmailAnalysis[]): string {
    const deleteCount = analyses.filter(a => a.recommendation === 'delete').length;
    const unsubscribeCount = analyses.filter(a => a.recommendation === 'unsubscribe').length;
    const reviewCount = analyses.filter(a => a.recommendation === 'review').length;

    return `Email Analysis Summary: ${deleteCount} senders recommended for deletion, ${unsubscribeCount} for unsubscription, ${reviewCount} for review.`;
  }
}
