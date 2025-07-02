// ENHANCED VOICE AGENT WORKER v14.1.0 - WITH DETAILED TIMING LOGS
// Deploy to: https://voice-agent-worker.metabilityllc1.workers.dev/

// Environment Variables needed:
// ELEVENLABS_API_KEY
// R2_PUBLIC_DOMAIN
// CLOUDFLARE_ACCOUNT_ID
// R2_BUCKET_NAME
// CLOUDFLARE_R2_TOKEN
// DEFAULT_VOICE_ID
// SUPABASE_URL
// SUPABASE_SERVICE_KEY

// Service Bindings needed:
// AI_SERVICE (bound to ai-processor-worker)
// DATABASE_SERVICE (bound to database-worker)

// =============================================================================
// ENVIRONMENT VALIDATION
// =============================================================================

function validateEnvironment(env) {
  const required = [
    'ELEVENLABS_API_KEY',
    'R2_PUBLIC_DOMAIN', 
    'CLOUDFLARE_ACCOUNT_ID',
    'R2_BUCKET_NAME',
    'CLOUDFLARE_R2_TOKEN',
    'DEFAULT_VOICE_ID',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY'
  ];
  
  const missing = required.filter(key => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✅ Environment validation passed');
}

// =============================================================================
// CIRCUIT BREAKER PATTERN
// =============================================================================

class CircuitBreaker {
  constructor(name, threshold = 3, timeout = 30000) {
    this.name = name;
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        console.warn(`🚫 Circuit breaker ${this.name} is OPEN`);
        throw new Error(`Service ${this.name} temporarily unavailable`);
      }
      this.state = 'HALF_OPEN';
      console.log(`🔄 Circuit breaker ${this.name} attempting HALF_OPEN`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    if (this.state !== 'CLOSED') {
      console.log(`✅ Circuit breaker ${this.name} restored to CLOSED`);
    }
  }

  onFailure() {
    this.failureCount++;
    console.warn(`❌ Circuit breaker ${this.name} failure ${this.failureCount}/${this.threshold}`);
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.error(`🚫 Circuit breaker ${this.name} opened for ${this.timeout/1000}s`);
    }
  }
}

// =============================================================================
// ENHANCED ERROR RESPONSES
// =============================================================================

class ErrorResponseManager {
  static getVoiceErrorResponse(error, businessName = 'our service') {
    const errorType = this.categorizeError(error);
    
    const responses = {
      'network': `I'm having trouble connecting right now. Please call ${businessName} directly or try again in a moment.`,
      'ai': `I'm experiencing some technical difficulties. Let me connect you with someone who can help.`,
      'voice': `I'm having trouble with voice generation. Please call our main number for immediate assistance.`,
      'database': `I'm having trouble accessing your information right now. Please try calling again in a moment.`,
      'validation': `I didn't receive your information properly. Could you please try your call again?`,
      'default': `I'm sorry, I'm experiencing technical issues. Please call our main number for immediate help.`
    };
    
    return responses[errorType] || responses['default'];
  }

  static categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('openai') || message.includes('ai')) return 'ai';
    if (message.includes('elevenlabs') || message.includes('voice')) return 'voice';
    if (message.includes('database') || message.includes('supabase')) return 'database';
    if (message.includes('validation') || message.includes('missing')) return 'validation';
    
    return 'default';
  }
}

// =============================================================================
// STRUCTURED LOGGING WITH TWILIO LATENCY
// =============================================================================

class StructuredLogger {
  static log(level, message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      worker: 'voice-agent',
      message,
      ...context
    };
    
    console.log(JSON.stringify(logEntry));
  }

  static info(message, context = {}) {
    this.log('info', message, context);
  }

  static warn(message, context = {}) {
    this.log('warn', message, context);
  }

  static error(message, context = {}) {
    this.log('error', message, context);
  }

  static performance(operation, duration, context = {}) {
    this.log('performance', `${operation} completed`, {
      ...context,
      duration_ms: duration,
      performance_category: duration > 1000 ? 'slow' : duration > 500 ? 'moderate' : 'fast'
    });
  }

  static cache(operation, context = {}) {
    this.log('cache', `Audio cache ${operation}`, context);
  }

  static twilio(operation, context = {}) {
    this.log('twilio', `Twilio ${operation}`, context);
  }
}

// =============================================================================
// ENHANCED PERFORMANCE MONITORING WITH TWILIO TRACKING
// =============================================================================

class EnhancedPerformanceMonitor {
  static startTimer() {
    return Date.now();
  }

  static logStage(stage, startTime, context = {}) {
    const duration = Date.now() - startTime;
    
    StructuredLogger.performance(`voice_${stage}`, duration, {
      stage,
      ...context
    });

    if (duration > 2000) {
      StructuredLogger.error(`Performance alert: ${stage} exceeded 2s`, {
        stage,
        duration_ms: duration,
        alert_type: 'critical_performance',
        ...context
      });
    } else if (duration > 1000) {
      StructuredLogger.warn(`Performance warning: ${stage} exceeded 1s`, {
        stage,
        duration_ms: duration,
        alert_type: 'warning_performance',
        ...context
      });
    }

    return Date.now();
  }

  static logTotal(totalStartTime, callSid, context = {}) {
    const totalTime = Date.now() - totalStartTime;
    
    StructuredLogger.performance('voice_call_total', totalTime, {
      call_sid: callSid,
      ...context
    });

    if (totalTime > 3000) {
      StructuredLogger.error('Critical: Voice call exceeded 3s', {
        call_sid: callSid,
        duration_ms: totalTime,
        alert_type: 'critical_latency',
        ...context
      });
    } else if (totalTime > 1500) {
      StructuredLogger.warn('Warning: Voice call exceeded 1.5s', {
        call_sid: callSid,
        duration_ms: totalTime,
        alert_type: 'warning_latency',
        ...context
      });
    }

    return totalTime;
  }

  static logTwilioLatency(operation, duration, context = {}) {
    StructuredLogger.twilio(`${operation} latency`, {
      ...context,
      duration_ms: duration,
      twilio_performance_category: duration > 200 ? 'slow' : duration > 100 ? 'moderate' : 'fast'
    });

    if (duration > 500) {
      StructuredLogger.error(`Twilio ${operation} exceeded 500ms`, {
        duration_ms: duration,
        alert_type: 'twilio_latency_critical',
        ...context
      });
    } else if (duration > 200) {
      StructuredLogger.warn(`Twilio ${operation} exceeded 200ms`, {
        duration_ms: duration,
        alert_type: 'twilio_latency_warning',
        ...context
      });
    }
  }
}

// =============================================================================
// DIRECT SUPABASE CLIENT FOR AUDIO CACHE
// =============================================================================

class DirectSupabaseClient {
  constructor(url, serviceKey) {
    this.url = url;
    this.serviceKey = serviceKey;
    this.headers = {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  async query(endpoint, method = 'GET', body = null) {
    try {
      const response = await fetch(`${this.url}/rest/v1/${endpoint}`, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : null
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase error: ${response.status} - ${errorText}`);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : [];
    } catch (error) {
      StructuredLogger.error('Direct Supabase query failed', {
        endpoint,
        method,
        error: error.message
      });
      throw error;
    }
  }
}

// =============================================================================
// RESPONSE AUDIO MATCHER - WITH CONVERSATION FLOW DETECTION
// =============================================================================

class ResponseAudioMatcher {
  constructor() {
    this.matchingRules = {
      'greeting': [
        'hi', 'hello', 'sarah', 'help you today', 'how can i help'
      ],
      'understand': [
        'i understand', 'let me help', 'help you with that'
      ],
      'what_appliance': [
        'what appliance', 'which appliance', 'appliance needs service'
      ],
      'what_issue': [
        'what issue', 'what\'s the issue', 'experiencing', 'what problem'
      ],
      'check_availability': [
        'check availability', 'check our availability', 'let me check'
      ],
      'diagnostic_fee': [
        'diagnostic fee', '89 dollars', 'goes toward', 'repair'
      ],
      'address_question': [
        'what is your address', 'address', 'where are you located'
      ],
      'time_preference': [
        'when would be convenient', 'mornings or afternoons', 'time preference'
      ],
      'appointment_scheduled': [
        'perfect', 'i have you scheduled', 'scheduled', 'appointment set'
      ],
      'anything_else': [
        'anything else', 'else i can help', 'other questions'
      ],
      'common_issue': [
        'common problem', 'definitely help', 'we can help'
      ],
      'technician_intro': [
        'mike rodriguez', 'technician', 'diagnose and fix'
      ],
      'repair_cost_range': [
        'repairs range from', '150 to 300', 'cost range'
      ],
      'business_hours': [
        'monday through friday', '8 am to 6 pm', 'business hours'
      ],
      'appointment_confirmed': [
        'appointment is confirmed', 'confirmed'
      ],
      'processing_moment': [
        'one moment', 'looking that up', 'please wait'
      ],
      'greeting_confirmed': [
        'great', 'how can i help', 'help you today'
      ],
      'greeting_hurry_sms': [
        'understand your concerns', 'respect your time', 'text message',
        'full name', 'address', 'appliance', 'scheduled faster'
      ]
    };
    
    this.conversationFlowPatterns = [
      'i can help with your',
      'i just need',
      'what city and zip',
      'best callback number',
      'morning or afternoon',
      'preferred time',
      'what\'s your full name',
      'what\'s your address',
      'what brand is your',
      'what\'s happening with',
      'what\'s wrong with',
      'what type of appliance',
      'perfect! i have'
    ];
  }

  isConversationFlowResponse(aiResponse) {
    if (!aiResponse) return false;
    
    // Don't skip cache for FAQ diagnostic responses
    if (aiResponse.includes('diagnostic fee') || 
        aiResponse.includes('$89') || 
        aiResponse.includes('repair')) {
      return false;
    }
    
    const responseLower = aiResponse.toLowerCase();
    return this.conversationFlowPatterns.some(pattern => 
      responseLower.includes(pattern)
    );
  }

  findBestMatch(aiResponse, audioCache) {
    if (!aiResponse || Object.keys(audioCache).length === 0) {
      return null;
    }

    if (this.isConversationFlowResponse(aiResponse)) {
      StructuredLogger.cache('conversation_flow_detected', {
        response_preview: aiResponse.substring(0, 50),
        skip_cache_matching: true
      });
      return null;
    }

    const responseLower = aiResponse.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const [templateKey, audioUrl] of Object.entries(audioCache)) {
      const keywords = this.matchingRules[templateKey] || [];
      let score = 0;

      for (const keyword of keywords) {
        if (responseLower.includes(keyword.toLowerCase())) {
          score += keyword.length;
        }
      }

      if (keywords.some(keyword => responseLower === keyword.toLowerCase())) {
        score += 50;
      }

      if (score > bestScore && score > 5) {
        bestScore = score;
        bestMatch = {
          templateKey,
          audioUrl,
          score,
          matchedKeywords: keywords.filter(k => responseLower.includes(k.toLowerCase()))
        };
      }
    }

    if (bestMatch) {
      StructuredLogger.cache('response_matched', {
        template_key: bestMatch.templateKey,
        score: bestMatch.score,
        matched_keywords: bestMatch.matchedKeywords,
        response_preview: aiResponse.substring(0, 50)
      });
    } else {
      StructuredLogger.cache('response_no_match', {
        response_preview: aiResponse.substring(0, 50),
        available_templates: Object.keys(audioCache)
      });
    }

    return bestMatch;
  }
}

// =============================================================================
// AUDIO CACHE MANAGER
// =============================================================================

class AudioCacheManager {
  constructor(db, directDb) {
    this.db = db;
    this.directDb = directDb;
    this.responseMatching = new ResponseAudioMatcher();
  }

  async getCachedAudio(organizationId, templateKey) {
    try {
      StructuredLogger.cache('lookup_started', {
        organization_id: organizationId,
        template_key: templateKey
      });

      const assets = await this.directDb.query(
        `audio_assets?organization_id=eq.${organizationId}&asset_key=eq.${templateKey}&active=eq.true&select=r2_key,r2_bucket&limit=1`
      );

      if (assets.length > 0) {
        const publicUrl = `https://pub-a28726938b5e40d5881029719fa8211c.r2.dev/${assets[0].r2_key}`;
        
        StructuredLogger.cache('cache_hit', {
          organization_id: organizationId,
          template_key: templateKey,
          audio_url: publicUrl
        });

        return publicUrl;
      }

      StructuredLogger.cache('cache_miss', {
        organization_id: organizationId,
        template_key: templateKey
      });

      return null;
    } catch (error) {
      StructuredLogger.error('Audio cache lookup failed', {
        organization_id: organizationId,
        template_key: templateKey,
        error: error.message
      });
      return null;
    }
  }

  async getCachedAudioBatch(organizationId, templateKeys) {
    try {
      const promises = templateKeys.map(key => 
        this.getCachedAudio(organizationId, key).catch(() => null)
      );
      
      const results = await Promise.all(promises);
      
      const audioCache = {};
      templateKeys.forEach((key, index) => {
        if (results[index]) {
          audioCache[key] = results[index];
        }
      });

      StructuredLogger.cache('batch_lookup_completed', {
        organization_id: organizationId,
        requested: templateKeys.length,
        found: Object.keys(audioCache).length,
        cache_keys: Object.keys(audioCache)
      });

      return audioCache;
    } catch (error) {
      StructuredLogger.error('Batch audio cache lookup failed', {
        organization_id: organizationId,
        error: error.message
      });
      return {};
    }
  }

  matchResponseToCache(aiResponse, audioCache) {
    return this.responseMatching.findBestMatch(aiResponse, audioCache);
  }

  async getGreetingAudio(organizationId, businessName) {
    try {
      let audioUrl = await this.getCachedAudio(organizationId, 'greeting');
      
      if (audioUrl) {
        StructuredLogger.cache('greeting_cache_hit', {
          organization_id: organizationId,
          business_name: businessName,
          disclaimer_included: true
        });
        return {
          audioUrl,
          fromCache: true,
          text: `Hi, this is Sarah from ${businessName}. Before we proceed, I would like to let you know you are on a recorded line and my responses can take 4 to 5 seconds as I will be updating your records during our conversation, so for me to better assist you please be patient with me. Would that be okay with you?`,
          requiresConfirmation: true
        };
      }

      StructuredLogger.cache('greeting_cache_miss', {
        organization_id: organizationId,
        business_name: businessName
      });

      return null;
    } catch (error) {
      StructuredLogger.error('Greeting audio lookup failed', {
        organization_id: organizationId,
        error: error.message
      });
      return null;
    }
  }

  async getConfirmationResponse(organizationId, customerResponse) {
    const responseLower = customerResponse.toLowerCase();
    
    const positiveWords = ['okay', 'yes', 'sure', 'fine', 'alright', 'ok', 'good', 'sounds good'];
    const isPositive = positiveWords.some(word => responseLower.includes(word));
    
    const negativeWords = ['no', 'hurry', 'rush', 'fast', 'quick', 'busy', 'time'];
    const isNegative = negativeWords.some(word => responseLower.includes(word));
    
    if (isPositive) {
      const audioUrl = await this.getCachedAudio(organizationId, 'greeting_confirmed');
      if (audioUrl) {
        return {
          audioUrl,
          fromCache: true,
          text: 'Great! How can I help you today?',
          continueConversation: true
        };
      }
    } else if (isNegative) {
      const audioUrl = await this.getCachedAudio(organizationId, 'greeting_hurry_sms');
      if (audioUrl) {
        return {
          audioUrl,
          fromCache: true,
          text: 'I understand your concerns and respect your time. Please send us a text message with your full name, address, what appliance is having an issue, appliance make and model if you have it, and what issues you are noticing. We can get your appointment scheduled faster. Will that be okay?',
          continueConversation: false
        };
      }
    }
    
    return null;
  }
}

// =============================================================================
// ENHANCED DATABASE CLIENT WITH CIRCUIT BREAKER
// =============================================================================

class EnhancedDatabaseClient {
  constructor(databaseService) {
    this.service = databaseService;
    this.circuitBreaker = new CircuitBreaker('database', 3, 30000);
  }

  async identifyOrganization(businessPhone) {
    if (!this.service || !businessPhone) return null;

    return this.circuitBreaker.execute(async () => {
      const request = new Request('http://internal/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: businessPhone })
      });

      const response = await this.service.fetch(request);
      
      if (!response.ok) {
        throw new Error(`Database identify failed: ${response.status}`);
      }
      
      const data = await response.json();
      StructuredLogger.info('Organization identified', {
        business_phone: businessPhone,
        organization_id: data.organizationId
      });
      
      return data.organizationId;
    });
  }

  async getOrganizationConfig(organizationId) {
    if (!this.service || !organizationId) return null;

    return this.circuitBreaker.execute(async () => {
      const request = new Request(`http://internal/config/${organizationId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await this.service.fetch(request);

      if (!response.ok) {
        throw new Error(`Config fetch failed: ${response.status}`);
      }
      
      const config = await response.json();
      StructuredLogger.info('Organization config loaded', {
        organization_id: organizationId,
        business_name: config?.business_name
      });
      
      return config;
    });
  }

  async getOrganizationFAQs(organizationId) {
    if (!this.service || !organizationId) return [];

    return this.circuitBreaker.execute(async () => {
      const request = new Request(`http://internal/organization/faqs?organizationId=${organizationId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await this.service.fetch(request);
      
      if (!response.ok) {
        throw new Error(`FAQ fetch failed: ${response.status}`);
      }
      
      const faqs = await response.json();
      StructuredLogger.info('FAQs loaded', {
        organization_id: organizationId,
        faq_count: faqs.length
      });
      
      return faqs;
    });
  }

  async batchCall(operations) {
    const promises = operations.map(async (op) => {
      try {
        switch (op.type) {
          case 'config':
            return await this.getOrganizationConfig(op.organizationId);
          case 'faqs':
            return await this.getOrganizationFAQs(op.organizationId);
          default:
            return null;
        }
      } catch (error) {
        StructuredLogger.error('Batch operation failed', {
          operation_type: op.type,
          error: error.message
        });
        return null;
      }
    });

    return Promise.all(promises);
  }
}

// =============================================================================
// ENHANCED AI CLIENT WITH CIRCUIT BREAKER
// =============================================================================

class EnhancedAIClient {
  constructor(aiService) {
    this.service = aiService;
    this.circuitBreaker = new CircuitBreaker('ai-service', 3, 30000);
  }

  async processMessage(speechResult, organizationId, customerPhone) {
    if (!this.service) {
      return "I understand you need help. What appliance is giving you trouble?";
    }

    return this.circuitBreaker.execute(async () => {
      const request = new Request('http://internal/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: speechResult,
          tenantId: organizationId,
          customerPhone: customerPhone
        })
      });

      const response = await this.service.fetch(request);

      if (!response.ok) {
        throw new Error(`AI processing failed: ${response.status}`);
      }
      
      const data = await response.json();
      const aiResponse = data.response || "I understand you need help. What appliance is giving you trouble?";
      
      StructuredLogger.info('AI processing completed', {
        organization_id: organizationId,
        customer_phone: customerPhone,
        input_length: speechResult?.length || 0,
        response_length: aiResponse.length,
        completion_percentage: data.metadata?.completionPercentage || 0
      });
      
      return aiResponse;
    });
  }
}

// =============================================================================
// ENHANCED ELEVENLABS CLIENT WITH RETRY LOGIC
// =============================================================================

class EnhancedElevenLabs {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.circuitBreaker = new CircuitBreaker('elevenlabs', 3, 30000);
  }

  async generateVoice(text, voiceId, retries = 2) {
    return this.circuitBreaker.execute(async () => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': this.apiKey
            },
            body: JSON.stringify({
              text: text,
              model_id: 'eleven_turbo_v2_5',
              voice_settings: {
                stability: 0.6,
                similarity_boost: 0.75,
                style: 0.1,
                use_speaker_boost: true
              },
              optimize_streaming_latency: 4,
              output_format: 'mp3_22050_32'
            })
          });

          if (!response.ok) {
            throw new Error(`ElevenLabs error: ${response.status}`);
          }

          const audioBuffer = await response.arrayBuffer();
          
          StructuredLogger.info('Voice generation successful', {
            voice_id: voiceId,
            text_length: text.length,
            audio_size: audioBuffer.byteLength,
            attempt: attempt + 1
          });
          
          return audioBuffer;
        } catch (error) {
          StructuredLogger.warn('Voice generation attempt failed', {
            attempt: attempt + 1,
            max_attempts: retries + 1,
            error: error.message
          });
          
          if (attempt === retries) {
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    });
  }
}

// =============================================================================
// ENHANCED R2 CLIENT WITH RETRY LOGIC
// =============================================================================

class EnhancedR2Client {
  constructor(env) {
    this.accountId = env.CLOUDFLARE_ACCOUNT_ID;
    this.bucketName = env.R2_BUCKET_NAME;
    this.token = env.CLOUDFLARE_R2_TOKEN;
    this.publicDomain = env.R2_PUBLIC_DOMAIN;
    this.circuitBreaker = new CircuitBreaker('r2-storage', 3, 30000);
  }

  async uploadAudio(audioBuffer, filename, retries = 2) {
    return this.circuitBreaker.execute(async () => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}/objects/${filename}`;
          
          const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=3600'
            },
            body: audioBuffer
          });

          if (!response.ok) {
            throw new Error(`R2 upload failed: ${response.status}`);
          }

          const cleanDomain = this.publicDomain.replace(/^https?:\/\//, '');
          const publicUrl = `https://${cleanDomain}/${filename}`;
          
          StructuredLogger.info('Audio upload successful', {
            filename,
            file_size: audioBuffer.byteLength,
            public_url: publicUrl,
            attempt: attempt + 1
          });
          
          return publicUrl;
        } catch (error) {
          StructuredLogger.warn('Audio upload attempt failed', {
            attempt: attempt + 1,
            max_attempts: retries + 1,
            filename,
            error: error.message
          });
          
          if (attempt === retries) {
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    });
  }
}

// =============================================================================
// INTELLIGENT FAQ MATCHER
// =============================================================================

class IntelligentFAQMatcher {
  static findBestMatch(faqs, userInput) {
    if (!faqs || faqs.length === 0 || !userInput) return null;

    try {
      const inputLower = userInput.toLowerCase();
      const matches = [];
      
      for (const faq of faqs) {
        let score = 0;
        
        if (faq.keywords) {
          const keywords = faq.keywords.split(',').map(k => k.trim().toLowerCase());
          for (const keyword of keywords) {
            if (keyword && inputLower.includes(keyword)) {
              score += 3;
            }
          }
        }
        
        if (faq.question) {
          const questionWords = faq.question.toLowerCase().split(' ');
          for (const word of questionWords) {
            if (word.length > 3 && inputLower.includes(word)) {
              score += 1;
            }
          }
        }
        
        if (faq.usage_count > 0) {
          score += Math.min(faq.usage_count / 10, 2);
        }
        
        if (score > 0) {
          matches.push({ ...faq, score });
        }
      }
      
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches.length > 0 && matches[0].score >= 2 ? matches[0] : null;
      
      if (bestMatch) {
        StructuredLogger.info('FAQ match found', {
          faq_id: bestMatch.id,
          score: bestMatch.score,
          question: bestMatch.question
        });
      }
      
      return bestMatch;
    } catch (error) {
      StructuredLogger.error('FAQ matching error', { error: error.message });
      return null;
    }
  }
}

// =============================================================================
// MAIN VOICE CALL HANDLER - WITH DETAILED TIMING LOGS
// =============================================================================

async function handleEnhancedVoiceCall(request, env, ctx) {
  // NEW: Add detailed timing logs
  const log = (stage, startTime) => {
    const duration = Date.now() - startTime;
    console.log(`🕐 TIMING: ${stage} took ${duration}ms`);
    return Date.now();
  };

  const twilioWebhookStart = Date.now();
  const totalStartTime = EnhancedPerformanceMonitor.startTimer();
  let stageTimer = totalStartTime;
  let timer = Date.now();
  
  try {
    validateEnvironment(env);
    timer = log('validate_environment', timer);
    
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/x-www-form-urlencoded')) {
      throw new Error('Invalid content type for Twilio webhook');
    }
    
    const formData = await request.formData();
    timer = log('parse_form_data', timer);
    
    const speechResult = formData.get('SpeechResult');
    const customerPhone = formData.get('From');
    const businessPhone = formData.get('To');
    const callSid = formData.get('CallSid') || 'unknown';
    
    const twilioProcessingTime = Date.now() - twilioWebhookStart;
    EnhancedPerformanceMonitor.logTwilioLatency('webhook_processing', twilioProcessingTime, {
      call_sid: callSid,
      has_speech: !!speechResult,
      form_data_size: Array.from(formData.entries()).length
    });
    
    timer = log('extract_form_fields', timer);
    
    stageTimer = EnhancedPerformanceMonitor.logStage('parse_webhook', stageTimer, {
      call_sid: callSid,
      has_speech: !!speechResult,
      twilio_processing_ms: twilioProcessingTime
    });
    
    StructuredLogger.info('Voice call received', {
      call_sid: callSid,
      customer_phone: customerPhone,
      business_phone: businessPhone,
      speech_result: speechResult,
      call_type: speechResult ? 'response' : 'initial',
      twilio_latency_ms: twilioProcessingTime
    });

    // Initialize enhanced clients
    const dbClient = new EnhancedDatabaseClient(env.DATABASE_SERVICE);
    const directDb = new DirectSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const aiClient = new EnhancedAIClient(env.AI_SERVICE);
    const elevenlabs = new EnhancedElevenLabs(env.ELEVENLABS_API_KEY);
    const r2Client = new EnhancedR2Client(env);
    const audioCache = new AudioCacheManager(dbClient, directDb);
    
    timer = log('initialize_clients', timer);

    // INITIAL CALL - Handle greeting with disclaimer
    if (!speechResult || speechResult === 'null') {
      StructuredLogger.info('Handling initial greeting with disclaimer', { call_sid: callSid });
      
      const organizationId = await dbClient.identifyOrganization(businessPhone);
      timer = log('identify_organization', timer);
      
      stageTimer = EnhancedPerformanceMonitor.logStage('identify_org', stageTimer, {
        call_sid: callSid,
        organization_id: organizationId
      });
      
      const config = await dbClient.getOrganizationConfig(organizationId);
      timer = log('get_organization_config', timer);
      
      stageTimer = EnhancedPerformanceMonitor.logStage('get_config', stageTimer, {
        call_sid: callSid,
        organization_id: organizationId
      });
      
      const businessName = config?.business_name || "ABZ Appliance Repair";
      
      const cachedGreeting = await audioCache.getGreetingAudio(organizationId, businessName);
      timer = log('check_greeting_cache', timer);
      
      stageTimer = EnhancedPerformanceMonitor.logStage('check_greeting_cache', stageTimer, {
        call_sid: callSid,
        cache_hit: !!cachedGreeting,
        has_disclaimer: cachedGreeting?.requiresConfirmation || false
      });
      
      let audioUrl;
      
      if (cachedGreeting && cachedGreeting.fromCache) {
        audioUrl = cachedGreeting.audioUrl;
        timer = log('use_cached_greeting', timer);
        
        StructuredLogger.cache('greeting_served_from_cache', {
          call_sid: callSid,
          organization_id: organizationId,
          audio_url: audioUrl,
          disclaimer_included: true
        });
      } else {
        const greeting = `Hi, this is Sarah from ${businessName}. Before we proceed, I would like to let you know you are on a recorded line and my responses can take 4 to 5 seconds as I will be updating your records during our conversation, so for me to better assist you please be patient with me. Would that be okay with you?`;
        const voiceId = config?.elevenlabs_voice_id || env.DEFAULT_VOICE_ID;
        
        const audioBuffer = await elevenlabs.generateVoice(greeting, voiceId);
        timer = log('generate_greeting_voice', timer);
        
        stageTimer = EnhancedPerformanceMonitor.logStage('generate_voice', stageTimer, {
          call_sid: callSid,
          text_length: greeting.length
        });
        
        const filename = `greeting-disclaimer-${organizationId || 'default'}-${callSid}-${Date.now()}.mp3`;
        audioUrl = await r2Client.uploadAudio(audioBuffer, filename);
        timer = log('upload_greeting_audio', timer);
        
        stageTimer = EnhancedPerformanceMonitor.logStage('upload_audio', stageTimer, {
          call_sid: callSid,
          filename
        });
      }
      
      timer = log('prepare_greeting_response', timer);
      
      EnhancedPerformanceMonitor.logTotal(totalStartTime, callSid, {
        call_type: 'greeting_with_disclaimer',
        organization_id: organizationId,
        used_cache: !!cachedGreeting,
        twilio_latency_ms: twilioProcessingTime
      });
      
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Gather input="speech" timeout="6" speechTimeout="auto" speechModel="phone_call" action="${new URL(request.url).origin}/voice" enhanced="true" language="en-US" hints="washer,dryer,dishwasher,refrigerator,broken,leaking,repair">
  </Gather>
</Response>`, {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    // Handle confirmation or regular conversation
    const organizationId = await this.directIdentifyOrganization(businessPhone, env);
    timer = log('identify_organization_for_response', timer);
    
    stageTimer = EnhancedPerformanceMonitor.logStage('identify_org', stageTimer, {
      call_sid: callSid,
      organization_id: organizationId
    });

    // Check if this is a confirmation response to disclaimer
    const isConfirmationResponse = speechResult && (
      speechResult.toLowerCase().includes('okay') ||
      speechResult.toLowerCase().includes('yes') ||
      speechResult.toLowerCase().includes('sure') ||
      speechResult.toLowerCase().includes('no') ||
      speechResult.toLowerCase().includes('hurry') ||
      speechResult.toLowerCase().includes('rush')
    );

    if (isConfirmationResponse) {
      StructuredLogger.info('Handling confirmation response', {
        call_sid: callSid,
        speech_result: speechResult
      });

      const confirmationResponse = await audioCache.getConfirmationResponse(organizationId, speechResult);
      timer = log('get_confirmation_response', timer);
      
      if (confirmationResponse) {
        stageTimer = EnhancedPerformanceMonitor.logStage('confirmation_response', stageTimer, {
          call_sid: callSid,
          continue_conversation: confirmationResponse.continueConversation
        });

        EnhancedPerformanceMonitor.logTotal(totalStartTime, callSid, {
          call_type: 'confirmation',
          organization_id: organizationId,
          used_cache: true,
          twilio_latency_ms: twilioProcessingTime
        });

        if (confirmationResponse.continueConversation) {
          return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${confirmationResponse.audioUrl}</Play>
  <Gather input="speech" timeout="6" speechTimeout="auto" speechModel="phone_call" action="${new URL(request.url).origin}/voice" enhanced="true" language="en-US" hints="washer,dryer,dishwasher,refrigerator,broken,leaking,repair">
  </Gather>
</Response>`, {
            headers: { 'Content-Type': 'text/xml' }
          });
        } else {
          return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${confirmationResponse.audioUrl}</Play>
</Response>`, {
            headers: { 'Content-Type': 'text/xml' }
          });
        }
      }
    }

    // Load config, FAQs, and audio cache in parallel for regular conversation
    const [config, faqs] = await dbClient.batchCall([
      { type: 'config', organizationId },
      { type: 'faqs', organizationId }
    ]);
    timer = log('load_config_and_faqs', timer);

    // Load common audio cache templates
    const commonTemplates = [
      'understand', 'what_appliance', 'what_issue', 'check_availability',
      'diagnostic_fee', 'common_issue', 'technician_intro', 'anything_else'
    ];
    const cachedAudio = await audioCache.getCachedAudioBatch(organizationId, commonTemplates);
    timer = log('load_audio_cache_batch', timer);
    
    stageTimer = EnhancedPerformanceMonitor.logStage('load_data_and_cache', stageTimer, {
      call_sid: callSid,
      faq_count: faqs ? faqs.length : 0,
      cached_audio_count: Object.keys(cachedAudio).length
    });

    // Try FAQ matching first
    const cachedFaq = IntelligentFAQMatcher.findBestMatch(faqs, speechResult);
    timer = log('faq_matching', timer);
    
    let aiResponse;
    let faqMatched = false;
    let faqId = null;
    let audioUrl = null;

    if (cachedFaq) {
      aiResponse = cachedFaq.response;
      faqMatched = true;
      faqId = cachedFaq.id;
      
      if (cachedFaq.audio_url) {
        audioUrl = cachedFaq.audio_url;
        timer = log('use_faq_audio', timer);
        
        StructuredLogger.info('Using pre-recorded FAQ audio', {
          call_sid: callSid,
          audio_url: cachedFaq.audio_url
        });
      }
      
      stageTimer = EnhancedPerformanceMonitor.logStage('faq_processing', stageTimer, {
        call_sid: callSid,
        faq_id: cachedFaq.id
      });
    } else {
      // AI processing
      aiResponse = await aiClient.processMessage(speechResult, organizationId, customerPhone);
      timer = log('ai_processing', timer);
      
      stageTimer = EnhancedPerformanceMonitor.logStage('ai_processing', stageTimer, {
        call_sid: callSid,
        organization_id: organizationId
      });
    }

    // Check if AI response matches cached audio (ONLY if no FAQ audio and NOT conversation flow)
    if (!audioUrl) {
      const matchedCache = audioCache.matchResponseToCache(aiResponse, cachedAudio);
      timer = log('cache_matching', timer);
      
      if (matchedCache) {
        audioUrl = matchedCache.audioUrl;
        timer = log('use_matched_cache', timer);
        
        StructuredLogger.cache('ai_response_matched_to_cache', {
          call_sid: callSid,
          template_key: matchedCache.templateKey,
          match_score: matchedCache.score,
          audio_url: audioUrl
        });
        
        stageTimer = EnhancedPerformanceMonitor.logStage('cache_match', stageTimer, {
          call_sid: callSid,
          template_key: matchedCache.templateKey
        });
      } else {
        StructuredLogger.info('No cache match - generating new audio', {
          call_sid: callSid,
          is_conversation_flow: audioCache.responseMatching.isConversationFlowResponse(aiResponse),
          response_preview: aiResponse.substring(0, 50)
        });
      }
    }

    // Generate voice if no cached audio found
    if (!audioUrl) {
      const voiceId = config?.elevenlabs_voice_id || env.DEFAULT_VOICE_ID;
      const audioBuffer = await elevenlabs.generateVoice(aiResponse, voiceId);
      timer = log('generate_voice', timer);
      
      stageTimer = EnhancedPerformanceMonitor.logStage('voice_generation', stageTimer, {
        call_sid: callSid,
        text_length: aiResponse.length
      });
      
      const filename = `response-${organizationId || 'default'}-${callSid}-${Date.now()}.mp3`;
      audioUrl = await r2Client.uploadAudio(audioBuffer, filename);
      timer = log('upload_audio', timer);
      
      stageTimer = EnhancedPerformanceMonitor.logStage('audio_upload', stageTimer, {
        call_sid: callSid,
        filename
      });
    }
    
    // Log interaction directly to Supabase
    const totalProcessingTime = Date.now() - totalStartTime;
    timer = log('prepare_logging', timer);
    
    ctx.waitUntil(
      (async () => {
        try {
          const response = await fetch(`${env.SUPABASE_URL}/rest/v1/interactions`, {
            method: 'POST',
            headers: {
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              organization_id: organizationId,
              customer_phone: customerPhone,
              speech_input: speechResult,
              ai_response: aiResponse,
              processing_time_ms: totalProcessingTime,
              // twilio_processing_time_ms: twilioProcessingTime,
              channel: 'voice',
              faq_matched: faqMatched,
              faq_id: faqId,
              //used_cache: !!audioUrl && !faqMatched
            })
          });
          console.log(`📝 Logging response: ${response.status}`);
          if (!response.ok) {
            const error = await response.text();
            console.error(`❌ Logging failed: ${error}`);
          }
        } catch (error) {
          console.error(`❌ Logging error: ${error.message}`);
        }
      })()
    );
    
    timer = log('log_interaction', timer);

    EnhancedPerformanceMonitor.logTotal(totalStartTime, callSid, {
      call_type: 'response',
      organization_id: organizationId,
      faq_matched: faqMatched,
      used_cache: Object.keys(cachedAudio).length > 0,
      is_conversation_flow: audioCache.responseMatching.isConversationFlowResponse(aiResponse),
      twilio_latency_ms: twilioProcessingTime
    });

    // Determine continuation
    const responseCheck = aiResponse.toLowerCase();
    const shouldContinue = responseCheck.includes('?') ||
                          responseCheck.includes('what') ||
                          responseCheck.includes('brand') ||
                          responseCheck.includes('schedule') ||
                          responseCheck.includes('help') ||
                          responseCheck.includes('assist') ||
                          responseCheck.includes('repair') ||
                          responseCheck.includes('service') ||
                          responseCheck.includes('available') ||
                          responseCheck.includes('need') ||
                          responseCheck.includes('callback') ||
                          responseCheck.includes('address') ||
                          responseCheck.includes('name') ||
                          responseCheck.includes('city') ||
                          responseCheck.includes('time') ||
                          faqMatched;

    timer = log('prepare_final_response', timer);
    console.log(`🕐 TOTAL CALL TIME: ${Date.now() - totalStartTime}ms`);

    if (shouldContinue) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Gather input="speech" timeout="6" speechTimeout="auto" speechModel="phone_call" action="${new URL(request.url).origin}/voice" enhanced="true" language="en-US" hints="washer,dryer,dishwasher,refrigerator,broken,leaking,repair">
  </Gather>
</Response>`, {
        headers: { 'Content-Type': 'text/xml' }
      });
    } else {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
</Response>`, {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

  } catch (error) {
    console.log(`🕐 ERROR OCCURRED AT: ${Date.now() - totalStartTime}ms`);
    
    StructuredLogger.error('Voice agent error', {
      error: error.message,
      stack: error.stack,
      call_sid: request.formData ? (await request.formData()).get('CallSid') : 'unknown'
    });
    
    EnhancedPerformanceMonitor.logTotal(totalStartTime, 'ERROR');
    
    const businessName = "our service";
    const errorMessage = ErrorResponseManager.getVoiceErrorResponse(error, businessName);
    
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${errorMessage}</Say>
</Response>`, {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}

// =============================================================================
// TWILIO LATENCY TEST ENDPOINT
// =============================================================================

async function handleLatencyTest(request, env, ctx) {
  const testStart = Date.now();
  
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') || 'test-' + Date.now();
    const from = formData.get('From') || '+1234567890';
    const to = formData.get('To') || '+15714097776';
    
    const parseTime = Date.now() - testStart;
    
    const processingStart = Date.now();
    await new Promise(resolve => setTimeout(resolve, 10));
    const processingTime = Date.now() - processingStart;
    
    const totalTime = Date.now() - testStart;
    
    StructuredLogger.twilio('latency_test_completed', {
      call_sid: callSid,
      parse_time_ms: parseTime,
      processing_time_ms: processingTime,
      total_time_ms: totalTime,
      test_timestamp: new Date().toISOString()
    });
    
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Latency test completed in ${totalTime} milliseconds. Parse time: ${parseTime}ms. Processing time: ${processingTime}ms.</Say>
</Response>`, {
      headers: { 'Content-Type': 'text/xml' }
    });
    
  } catch (error) {
    const totalTime = Date.now() - testStart;
    
    StructuredLogger.error('Latency test failed', {
      error: error.message,
      total_time_ms: totalTime
    });
    
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Latency test failed after ${totalTime} milliseconds. Error: ${error.message}</Say>
</Response>`, {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}

// =============================================================================
// MAIN REQUEST HANDLER
// =============================================================================

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  
  if (url.pathname === '/voice' || url.pathname === '/') {
    return handleEnhancedVoiceCall(request, env, ctx);
  }
  
  if (url.pathname === '/test-latency' && request.method === 'POST') {
    return handleLatencyTest(request, env, ctx);
  }
  
  if (url.pathname === '/test-db' && request.method === 'GET') {
    try {
      if (!env.DATABASE_SERVICE) {
        return Response.json({ error: 'DATABASE_SERVICE binding missing' });
      }
      
      const request = new Request('http://internal/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await env.DATABASE_SERVICE.fetch(request);
      const data = await response.text();
      
      return Response.json({ 
        success: true, 
        database_response: data,
        binding_works: true 
      });
    } catch (error) {
      return Response.json({ 
        success: false, 
        error: error.message,
        binding_works: false 
      });
    }
  }
  
  if (url.pathname === '/test-db-log' && request.method === 'POST') {
    try {
      const request = new Request('http://internal/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: "86851e15-2618-4105-93be-0bfb023f1aec",
          customerPhone: "+1234567890",
          speech: "test from voice worker",
          response: "test response",
          processingTime: 1000,
          faqMatched: false,
          channel: "voice"
        })
      });

      const response = await env.DATABASE_SERVICE.fetch(request);
      const data = await response.text();
      
      return Response.json({ 
        success: response.ok, 
        status: response.status,
        database_response: data
      });
    } catch (error) {
      return Response.json({ 
        success: false, 
        error: error.message
      });
    }
  }
  
  if (url.pathname === '/test-direct-log' && request.method === 'POST') {
    try {
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/interactions`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organization_id: "86851e15-2618-4105-93be-0bfb023f1aec",
          customer_phone: "+1234567890",
          speech_input: "test direct from voice worker",
          ai_response: "test response",
          processing_time_ms: 1000,
          channel: "voice",
          faq_matched: false
        })
      });

      const data = await response.text();
      
      return Response.json({ 
        success: response.ok, 
        status: response.status,
        response: data
      });
    } catch (error) {
      return Response.json({ 
        success: false, 
        error: error.message
      });
    }
  }
  
  if (url.pathname === '/health') {
    try {
      validateEnvironment(env);
      return Response.json({
        status: 'healthy',
        version: '14.1.0-detailed-timing-logs',
        timestamp: new Date().toISOString(),
        features: [
          'detailed-timing-logs',
          'twilio-latency-tracking',
          'conversation-flow-priority',
          'intelligent-cache-matching',
          'conversation-flow-detection',
          'enhanced-performance-monitoring',
          'faq-integration',
          'circuit-breaker-protection',
          'advanced-error-handling',
          'latency-test-endpoint',
          'direct-supabase-logging'
        ]
      });
    } catch (error) {
      return Response.json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  }
  
  if (url.pathname === '/status') {
    return new Response(`
🎤 ENHANCED VOICE AGENT WORKER v14.1.0 - WITH DETAILED TIMING LOGS

🆕 NEW DETAILED TIMING FEATURES:
✅ Stage-by-Stage Timing - Logs duration of each processing step
✅ Bottleneck Identification - Shows exactly where delays occur
✅ Detailed Console Logs - TIMING: [stage] took [X]ms format
✅ Total Call Time - Complete end-to-end timing
✅ Direct Supabase Logging - Bypasses broken database worker

🕐 TIMING BREAKDOWN TRACKING:
1. validate_environment - Environment validation
2. parse_form_data - Twilio form data parsing
3. extract_form_fields - Field extraction from form
4. initialize_clients - Client initialization
5. identify_organization - Organization lookup
6. get_organization_config - Config loading
7. check_greeting_cache - Audio cache lookup
8. load_config_and_faqs - Data loading
9. load_audio_cache_batch - Batch cache loading
10. faq_matching - FAQ pattern matching
11. ai_processing - AI service call
12. cache_matching - Response cache matching
13. generate_voice - ElevenLabs voice generation
14. upload_audio - R2 audio upload
15. log_interaction - Database logging
16. prepare_final_response - Response preparation

📊 TIMING LOG FORMAT:
🕐 TIMING: [stage_name] took [duration]ms
🕐 TOTAL CALL TIME: [total_duration]ms

🔍 BOTTLENECK DETECTION:
- Look for stages taking >1000ms in logs
- Identify which stage causes 6-second delays
- Compare cached vs non-cached response times
- Track AI processing vs voice generation timing

🚀 DEBUGGING WORKFLOW:
1. Make voice call to +15714097776
2. Say: "My washer is broken"
3. Check Cloudflare Worker logs for timing breakdown
4. Identify which stage takes 6+ seconds
5. Focus optimization on that specific stage

⚡ EXPECTED TIMING RANGES:
- parse_form_data: <10ms
- identify_organization: 50-200ms
- load_config_and_faqs: 100-300ms
- faq_matching: <50ms
- ai_processing: 500-2000ms (main suspect)
- generate_voice: 500-1500ms (main suspect)
- upload_audio: 200-500ms
- Total (cached): 500-1000ms
- Total (AI + voice): 1000-3000ms

🎯 LIKELY BOTTLENECKS:
1. AI Processing (ai_processing stage)
2. Voice Generation (generate_voice stage)
3. Audio Upload (upload_audio stage)
4. Config/FAQ Loading (load_data_and_cache stage)

Worker URL: ${request.url}
Health Check: ${request.url}/health
Latency Test: ${request.url}/test-latency (POST)
Database Test: ${request.url}/test-db

🕐 NOW WITH COMPLETE TIMING VISIBILITY - FIND THE 6-SECOND BOTTLENECK! 🕐
    `, {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  return new Response('Not Found', { status: 404 });
}

// ADD THIS FUNCTION HERE:
async function directIdentifyOrganization(businessPhone, env) {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/tenant_configs?business_phone=eq.${encodeURIComponent(businessPhone)}&select=organization_id&limit=1`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    });
    
    const data = await response.json();
    return data[0]?.organization_id || '86851e15-2618-4105-93be-0bfb023f1aec';
  } catch (error) {
    return '86851e15-2618-4105-93be-0bfb023f1aec';
  }
}

// Main export
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};
