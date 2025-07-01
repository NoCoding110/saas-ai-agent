// DATABASE WORKER WITH FAQ SUPPORT AND MISSING ENDPOINTS - COMPLETE FILE
// Copy this entire file to replace your existing database-worker.js
// Worker Name: database-worker
// URL: https://database-worker.your-account.workers.dev

// Environment Variables needed:
// SUPABASE_URL
// SUPABASE_SERVICE_KEY

// Supabase client function
async function callSupabase(url, serviceKey, endpoint, method = 'GET', body = null) {
  const supabaseUrl = `${url}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(supabaseUrl, options);
  const responseText = await response.text();
  
  if (!response.ok) {
    console.error(`Supabase error: ${response.status} - ${responseText}`);
    throw new Error(`Database error: ${response.status}`);
  }
  
  return responseText ? JSON.parse(responseText) : [];
}

// ============================================================================= 
// NEW FUNCTIONS FOR VOICE AGENT INTEGRATION
// =============================================================================

// Identify organization by business phone
async function identifyOrganization(businessPhone, env) {
  try {
    console.log(`🔍 Identifying organization for phone: ${businessPhone}`);
    
    // Try tenant_configs first (if you have this table)
    try {
      const configs = await callSupabase(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_KEY,
        `tenant_configs?business_phone=eq.${encodeURIComponent(businessPhone)}&select=organization_id,business_name&limit=1`
      );
      
      if (configs.length > 0) {
        console.log(`✅ Found organization via tenant_configs: ${configs[0].organization_id}`);
        return configs[0].organization_id;
      }
    } catch (error) {
      console.log('No tenant_configs table, trying organizations...');
    }
    
    // Fallback to organizations table
    try {
      const orgs = await callSupabase(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_KEY,
        `organizations?phone=eq.${encodeURIComponent(businessPhone)}&select=id,name&limit=1`
      );
      
      if (orgs.length > 0) {
        console.log(`✅ Found organization via organizations: ${orgs[0].id}`);
        return orgs[0].id;
      }
    } catch (error) {
      console.log('No organizations table with phone column...');
    }
    
    // Try with different phone column names
    try {
      const orgs = await callSupabase(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_KEY,
        `organizations?business_phone=eq.${encodeURIComponent(businessPhone)}&select=id,name&limit=1`
      );
      
      if (orgs.length > 0) {
        console.log(`✅ Found organization via organizations.business_phone: ${orgs[0].id}`);
        return orgs[0].id;
      }
    } catch (error) {
      console.log('No organizations table with business_phone column...');
    }
    
    // Default fallback for your specific org
    console.log('❌ No organization found, using default');
    return '86851e15-2618-4105-93be-0bfb023f1aec'; // Your org ID
    
  } catch (error) {
    console.error('Failed to identify organization:', error);
    return '86851e15-2618-4105-93be-0bfb023f1aec'; // Fallback to your org ID
  }
}

// Get organization configuration
async function getOrganizationConfig(organizationId, env) {
  try {
    console.log(`⚙️ Getting config for organization: ${organizationId}`);
    
    // Try tenant_configs first
    try {
      const configs = await callSupabase(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_KEY,
        `tenant_configs?organization_id=eq.${organizationId}&select=*&limit=1`
      );
      
      if (configs.length > 0) {
        console.log(`✅ Found config via tenant_configs`);
        return configs[0];
      }
    } catch (error) {
      console.log('No tenant_configs table, trying organizations...');
    }
    
    // Fallback to organizations table
    try {
      const orgs = await callSupabase(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_KEY,
        `organizations?id=eq.${organizationId}&select=id,name,elevenlabs_voice_id&limit=1`
      );
      
      if (orgs.length > 0) {
        console.log(`✅ Found config via organizations`);
        return {
          organization_id: orgs[0].id,
          business_name: orgs[0].name || 'ABZ Appliance Repair',
          elevenlabs_voice_id: orgs[0].elevenlabs_voice_id || '21m00Tcm4TlvDq8ikWAM'
        };
      }
    } catch (error) {
      console.log('Error accessing organizations table:', error.message);
    }
    
    // Default config
    console.log('❌ No config found, using defaults');
    return {
      organization_id: organizationId,
      business_name: 'ABZ Appliance Repair',
      elevenlabs_voice_id: '21m00Tcm4TlvDq8ikWAM'
    };
    
  } catch (error) {
    console.error('Failed to get organization config:', error);
    return {
      organization_id: organizationId,
      business_name: 'ABZ Appliance Repair',
      elevenlabs_voice_id: '21m00Tcm4TlvDq8ikWAM'
    };
  }
}

// Get organization FAQs
async function getOrganizationFAQs(organizationId, env) {
  try {
    console.log(`❓ Getting FAQs for organization: ${organizationId}`);
    
    // Try different possible column names for organization/company ID
    let faqs = [];
    
    // Try organization_id first
    try {
      faqs = await callSupabase(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_KEY,
        `faqs?organization_id=eq.${organizationId}&select=id,question,response,keywords,category,usage_count,audio_url`
      );
      if (faqs.length > 0) {
        console.log(`✅ Found ${faqs.length} FAQs via organization_id`);
      }
    } catch (error) {
      console.log('No organization_id column, trying company_id...');
    }
    
    // Fallback to company_id
    if (faqs.length === 0) {
      try {
        faqs = await callSupabase(
          env.SUPABASE_URL,
          env.SUPABASE_SERVICE_KEY,
          `faqs?company_id=eq.${organizationId}&select=id,question,response,keywords,category,usage_count,audio_url`
        );
        if (faqs.length > 0) {
          console.log(`✅ Found ${faqs.length} FAQs via company_id`);
        }
      } catch (error) {
        console.log('No company_id column either');
      }
    }
    
    // If still no FAQs, try tenant_id
    if (faqs.length === 0) {
      try {
        faqs = await callSupabase(
          env.SUPABASE_URL,
          env.SUPABASE_SERVICE_KEY,
          `faqs?tenant_id=eq.${organizationId}&select=id,question,response,keywords,category,usage_count,audio_url`
        );
        if (faqs.length > 0) {
          console.log(`✅ Found ${faqs.length} FAQs via tenant_id`);
        }
      } catch (error) {
        console.log('No tenant_id column either');
      }
    }
    
    // If still no FAQs, try without organization filter to see if table exists
    if (faqs.length === 0) {
      try {
        const allFaqs = await callSupabase(
          env.SUPABASE_URL,
          env.SUPABASE_SERVICE_KEY,
          `faqs?select=id,question,response,keywords,category,usage_count,audio_url&limit=5`
        );
        console.log(`📋 FAQ table exists with ${allFaqs.length} total FAQs, but none for organization ${organizationId}`);
      } catch (error) {
        console.log('No faqs table exists');
      }
    }
    
    console.log(`✅ Returning ${faqs.length} FAQs for organization`);
    return faqs || [];
    
  } catch (error) {
    console.error('Failed to get organization FAQs:', error);
    return [];
  }
}

// =============================================================================
// EXISTING FUNCTIONS
// =============================================================================

// Get customer information
async function getCustomer(phone, tenantId, env) {
  try {
    console.log(`📋 Getting customer: ${phone} (Tenant: ${tenantId})`);
    
    // Build query with tenant filtering if available
    let query = `customers?phone=eq.${encodeURIComponent(phone)}&select=id,name,total_interactions,last_contact`;
    if (tenantId) {
      query += `&tenant_id=eq.${tenantId}`;
    }
    
    const customers = await callSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, query);
    
    if (customers.length > 0) {
      console.log(`✅ Found customer: ${customers[0].name || 'Unknown'}`);
      return customers[0];
    }
    
    console.log('❌ Customer not found');
    return null;
  } catch (error) {
    console.error('Failed to get customer:', error);
    return null;
  }
}

// Create or update customer
async function upsertCustomer(phone, tenantId, env) {
  try {
    console.log(`👤 Upserting customer: ${phone} (Tenant: ${tenantId})`);
    
    // Try to find existing customer
    const existing = await getCustomer(phone, tenantId, env);
    
    if (existing) {
      // Update existing customer
      const updated = await callSupabase(
        env.SUPABASE_URL, 
        env.SUPABASE_SERVICE_KEY,
        `customers?id=eq.${existing.id}`,
        'PATCH',
        {
          last_contact: new Date().toISOString(),
          total_interactions: (existing.total_interactions || 0) + 1
        }
      );
      
      console.log(`✅ Updated customer: ${existing.id}`);
      return { 
        ...existing, 
        total_interactions: (existing.total_interactions || 0) + 1 
      };
    } else {
      // Create new customer
      const newCustomer = await callSupabase(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_KEY,
        'customers',
        'POST',
        {
          phone: phone,
          tenant_id: tenantId,
          first_contact_date: new Date().toISOString(),
          last_contact_date: new Date().toISOString(),
          total_interactions: 1,
          status: 'active'
        }
      );
      
      console.log(`✅ Created customer: ${newCustomer[0].id}`);
      return newCustomer[0];
    }
  } catch (error) {
    console.error('Failed to upsert customer:', error);
    return null;
  }
}

// Log interaction
async function logInteraction(data, env) {
  try {
    console.log(`📝 Logging interaction for tenant: ${data.organizationId || data.tenantId}`);
    
    // Ensure customer exists
    const customer = await upsertCustomer(data.customerPhone, data.organizationId || data.tenantId, env);
    
    // Log the interaction
    await callSupabase(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
      'interactions',
      'POST',
      {
        tenant_id: data.organizationId || data.tenantId,
        customer_id: customer?.id,
        customer_phone: data.customerPhone,
        speech_input: data.speech,
        ai_response: data.response,
        processing_time_ms: data.processingTime,
        channel: 'voice',
        intent: data.intent || null,
        confidence_score: data.confidenceScore || null,
        faq_matched: data.faqMatched || false,
        faq_id: data.faqId || null,
        used_cache: data.usedCache || false,
        created_at: new Date().toISOString()
      }
    );
    
    console.log('✅ Interaction logged successfully');
    return { success: true };
  } catch (error) {
    console.error('Failed to log interaction:', error);
    return { success: false, error: error.message };
  }
}

// Log SMS interaction
async function logSMSInteraction(data, env) {
  try {
    console.log(`📱 Logging SMS interaction for tenant: ${data.tenantId}`);
    
    // Ensure customer exists
    const customer = await upsertCustomer(data.customerPhone, data.tenantId, env);
    
    // Log the SMS interaction
    await callSupabase(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
      'interactions',
      'POST',
      {
        tenant_id: data.tenantId,
        customer_id: customer?.id,
        customer_phone: data.customerPhone,
        speech_input: data.message,
        ai_response: data.response,
        channel: 'sms',
        intent: data.intent || null,
        confidence_score: data.confidenceScore || null,
        faq_matched: data.faqMatched || false,
        faq_id: data.faqId || null,
        created_at: new Date().toISOString()
      }
    );
    
    console.log('✅ SMS interaction logged successfully');
    return { success: true };
  } catch (error) {
    console.error('Failed to log SMS interaction:', error);
    return { success: false, error: error.message };
  }
}

// Get conversation history
async function getConversationHistory(phone, tenantId, limit = 5, env) {
  try {
    console.log(`💬 Getting conversation history for: ${phone}`);
    
    let query = `interactions?customer_phone=eq.${encodeURIComponent(phone)}&order=created_at.desc&limit=${limit}&select=speech_input,ai_response,created_at,channel`;
    if (tenantId) {
      query += `&tenant_id=eq.${tenantId}`;
    }
    
    const interactions = await callSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, query);
    
    console.log(`✅ Found ${interactions.length} interactions`);
    return interactions.reverse(); // Return in chronological order
  } catch (error) {
    console.error('Failed to get conversation history:', error);
    return [];
  }
}

// Get FAQ match for a query
async function getFAQMatch(companyId, query, env) {
  try {
    console.log(`🔍 FAQ lookup for company ${companyId}: "${query}"`);
    
    // Get FAQs for company
    const faqs = await callSupabase(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
      `faqs?company_id=eq.${companyId}&select=id,question,response,keywords,category,usage_count`
    );
    
    if (!faqs || faqs.length === 0) {
      console.log('❌ No FAQs found for company');
      return null;
    }
    
    console.log(`📋 Found ${faqs.length} FAQs for company`);
    
    // Score FAQs based on keyword matches
    const queryLower = query.toLowerCase();
    const matches = [];
    
    for (const faq of faqs) {
      let score = 0;
      
      // Score based on keywords
      if (faq.keywords) {
        const keywords = faq.keywords.split(',').map(k => k.trim().toLowerCase());
        for (const keyword of keywords) {
          if (keyword && queryLower.includes(keyword)) {
            score += 3; // High score for keyword matches
          }
        }
      }
      
      // Score based on question text
      if (faq.question) {
        const questionWords = faq.question.toLowerCase().split(' ');
        for (const word of questionWords) {
          if (word.length > 3 && queryLower.includes(word)) {
            score += 1;
          }
        }
      }
      
      // Boost score for frequently used FAQs
      if (faq.usage_count > 0) {
        score += Math.min(faq.usage_count / 10, 2); // Max 2 point boost
      }
      
      if (score > 0) {
        matches.push({ ...faq, score });
      }
    }
    
    // Sort by score and return best match
    matches.sort((a, b) => b.score - a.score);
    const bestMatch = matches.length > 0 && matches[0].score >= 2 ? matches[0] : null;
    
    if (bestMatch) {
      console.log(`✅ Best FAQ match found with score: ${bestMatch.score}`);
    } else {
      console.log('❌ No FAQ match with sufficient confidence');
    }
    
    return bestMatch;
  } catch (error) {
    console.error('FAQ lookup failed:', error);
    return null;
  }
}

// Update FAQ usage count
async function updateFAQUsage(faqId, env) {
  try {
    if (!faqId) return;
    
    console.log(`📊 Updating FAQ usage count for FAQ: ${faqId}`);
    
    // Get current usage count
    const currentFAQ = await callSupabase(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
      `faqs?id=eq.${faqId}&select=usage_count`
    );
    
    if (currentFAQ.length > 0) {
      const newCount = (currentFAQ[0].usage_count || 0) + 1;
      
      // Update usage count
      await callSupabase(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_KEY,
        `faqs?id=eq.${faqId}`,
        'PATCH',
        { usage_count: newCount }
      );
      
      console.log(`✅ Updated FAQ usage count to: ${newCount}`);
    }
  } catch (error) {
    console.error('Failed to update FAQ usage:', error);
  }
}

// Get analytics data
async function getAnalytics(tenantId, period = '7d', env) {
  try {
    console.log(`📊 Getting analytics for tenant: ${tenantId}, period: ${period}`);
    
    // Calculate date range
    const now = new Date();
    const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 1;
    const startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    let query = `interactions?created_at=gte.${startDate.toISOString()}&select=channel,created_at,processing_time_ms,intent,faq_matched`;
    if (tenantId) {
      query += `&tenant_id=eq.${tenantId}`;
    }
    
    const interactions = await callSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, query);
    
    // Calculate metrics
    const totalInteractions = interactions.length;
    const voiceInteractions = interactions.filter(i => i.channel === 'voice').length;
    const smsInteractions = interactions.filter(i => i.channel === 'sms').length;
    const faqMatches = interactions.filter(i => i.faq_matched).length;
    const avgProcessingTime = interactions
      .filter(i => i.processing_time_ms)
      .reduce((sum, i) => sum + i.processing_time_ms, 0) / 
      interactions.filter(i => i.processing_time_ms).length || 0;
    
    // Intent breakdown
    const intentBreakdown = {};
    interactions.forEach(i => {
      if (i.intent) {
        intentBreakdown[i.intent] = (intentBreakdown[i.intent] || 0) + 1;
      }
    });
    
    const analytics = {
      period,
      totalInteractions,
      voiceInteractions,
      smsInteractions,
      faqMatches,
      faqMatchRate: totalInteractions > 0 ? (faqMatches / totalInteractions * 100).toFixed(1) : 0,
      avgProcessingTime: Math.round(avgProcessingTime),
      intentBreakdown,
      dailyBreakdown: {}
    };
    
    // Daily breakdown
    interactions.forEach(interaction => {
      const date = interaction.created_at.split('T')[0];
      analytics.dailyBreakdown[date] = (analytics.dailyBreakdown[date] || 0) + 1;
    });
    
    console.log(`✅ Analytics calculated: ${totalInteractions} total interactions`);
    return analytics;
  } catch (error) {
    console.error('Failed to get analytics:', error);
    return null;
  }
}

// =============================================================================
// MAIN REQUEST HANDLER
// =============================================================================

// Handle different request types
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  
  // CORS headers for cross-worker communication
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =============================================================================
    // NEW ENDPOINTS FOR VOICE AGENT INTEGRATION
    // =============================================================================

    // IDENTIFY ORGANIZATION ENDPOINT
    if (url.pathname === '/identify' && request.method === 'POST') {
      const { phone } = await request.json();
      const organizationId = await identifyOrganization(phone, env);
      return Response.json({ organizationId }, { headers: corsHeaders });
    }

    // GET ORGANIZATION CONFIG ENDPOINT  
    if (url.pathname.startsWith('/config/') && request.method === 'GET') {
      const organizationId = url.pathname.split('/config/')[1];
      const config = await getOrganizationConfig(organizationId, env);
      return Response.json(config, { headers: corsHeaders });
    }

    // GET ORGANIZATION FAQS ENDPOINT
    if (url.pathname === '/organization/faqs' && request.method === 'GET') {
      const organizationId = url.searchParams.get('organizationId');
      const faqs = await getOrganizationFAQs(organizationId, env);
      return Response.json(faqs, { headers: corsHeaders });
    }

    // =============================================================================
    // EXISTING ENDPOINTS
    // =============================================================================

    // Route requests
    if (url.pathname === '/log' && request.method === 'POST') {
      const data = await request.json();
      const result = await logInteraction(data, env);
      return Response.json(result, { headers: corsHeaders });
    }

    if (url.pathname === '/sms-log' && request.method === 'POST') {
      const data = await request.json();
      const result = await logSMSInteraction(data, env);
      return Response.json(result, { headers: corsHeaders });
    }

    if (url.pathname === '/customer' && request.method === 'POST') {
      const { phone, tenantId } = await request.json();
      const customer = await getCustomer(phone, tenantId, env);
      return Response.json(customer, { headers: corsHeaders });
    }

    if (url.pathname === '/history' && request.method === 'POST') {
      const { phone, tenantId, limit } = await request.json();
      const history = await getConversationHistory(phone, tenantId, limit, env);
      return Response.json(history, { headers: corsHeaders });
    }

    // FAQ ENDPOINT
    if (url.pathname === '/faqs' && request.method === 'POST') {
      const { companyId, query } = await request.json();
      const faq = await getFAQMatch(companyId, query, env);
      return Response.json({ faq }, { headers: corsHeaders });
    }

    // FAQ USAGE UPDATE ENDPOINT
    if (url.pathname === '/faq-usage' && request.method === 'POST') {
      const { faqId } = await request.json();
      await updateFAQUsage(faqId, env);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // DEBUG FAQ ENDPOINT
    if (url.pathname === '/debug-faqs' && request.method === 'GET') {
      const companyId = url.searchParams.get('companyId') || '123';
      
      try {
        console.log(`🔍 Debug FAQ lookup for company ${companyId}`);
        
        // Test direct Supabase access
        const faqs = await callSupabase(
          env.SUPABASE_URL,
          env.SUPABASE_SERVICE_KEY,
          `faqs?company_id=eq.${companyId}&select=id,question,response,keywords,category,usage_count`
        );
        
        // Also try to get ALL FAQs to see what's in the table
        const allFAQs = await callSupabase(
          env.SUPABASE_URL,
          env.SUPABASE_SERVICE_KEY,
          `faqs?select=id,company_id,keywords,response&limit=10`
        );
        
        return Response.json({
          debug: true,
          companyId,
          supabaseUrl: env.SUPABASE_URL,
          hasServiceKey: !!env.SUPABASE_SERVICE_KEY,
          faqsFound: faqs ? faqs.length : 0,
          faqs: faqs || null,
          allFAQs: allFAQs || null,
          query: `faqs?company_id=eq.${companyId}&select=id,question,response,keywords,category,usage_count`
        }, { headers: corsHeaders });
        
      } catch (error) {
        return Response.json({
          debug: true,
          error: error.message,
          companyId,
          supabaseUrl: env.SUPABASE_URL,
          hasServiceKey: !!env.SUPABASE_SERVICE_KEY
        }, { headers: corsHeaders });
      }
    }

    // DEBUG ORGANIZATION ENDPOINT
    if (url.pathname === '/debug-org' && request.method === 'GET') {
      const phone = url.searchParams.get('phone') || '+1234567890';
      const orgId = url.searchParams.get('orgId') || '86851e15-2618-4105-93be-0bfb023f1aec';
      
      try {
        console.log(`🔍 Debug organization lookup`);
        
        // Test organization identification
        const identifiedOrg = await identifyOrganization(phone, env);
        
        // Test config retrieval
        const config = await getOrganizationConfig(orgId, env);
        
        // Test FAQ retrieval
        const faqs = await getOrganizationFAQs(orgId, env);
        
        return Response.json({
          debug: true,
          phone,
          orgId,
          identifiedOrg,
          config,
          faqCount: faqs.length,
          faqs: faqs.slice(0, 3), // First 3 FAQs only
          supabaseUrl: env.SUPABASE_URL,
          hasServiceKey: !!env.SUPABASE_SERVICE_KEY
        }, { headers: corsHeaders });
        
      } catch (error) {
        return Response.json({
          debug: true,
          error: error.message,
          phone,
          orgId,
          supabaseUrl: env.SUPABASE_URL,
          hasServiceKey: !!env.SUPABASE_SERVICE_KEY
        }, { headers: corsHeaders });
      }
    }

    if (url.pathname === '/analytics' && request.method === 'POST') {
      const { tenantId, period } = await request.json();
      const analytics = await getAnalytics(tenantId, period, env);
      return Response.json(analytics, { headers: corsHeaders });
    }

    if (url.pathname === '/status' || url.pathname === '/') {
      return new Response(`
📋 Enhanced Database Worker Status with Voice Agent Integration

Environment Variables:
✅ SUPABASE_URL: ${env.SUPABASE_URL ? 'Set' : 'Missing'}
✅ SUPABASE_SERVICE_KEY: ${env.SUPABASE_SERVICE_KEY ? 'Set' : 'Missing'}

NEW VOICE AGENT ENDPOINTS:
🔗 POST /identify - Identify organization by phone
  Body: { "phone": "+1234567890" }
🔗 GET /config/{organizationId} - Get organization configuration
🔗 GET /organization/faqs?organizationId=UUID - Get organization FAQs

EXISTING ENDPOINTS:
- POST /log - Log voice interactions
  Body: { "organizationId": "id", "customerPhone": "+123", "speech": "text", "response": "text", "processingTime": 1000, "intent": "emergency", "faqMatched": true, "faqId": 72 }
- POST /sms-log - Log SMS interactions  
  Body: { "tenantId": "id", "customerPhone": "+123", "message": "text", "response": "text", "intent": "pricing", "faqMatched": false }
- POST /customer - Get customer info
  Body: { "phone": "+123", "tenantId": "id" }
- POST /history - Get conversation history
  Body: { "phone": "+123", "tenantId": "id", "limit": 5 }
- POST /faqs - Find best FAQ match
  Body: { "companyId": 123, "query": "washer broken" }
- POST /faq-usage - Update FAQ usage count
  Body: { "faqId": 72 }
- GET /debug-faqs?companyId=123 - Debug FAQ lookup
- GET /debug-org?phone=+123&orgId=UUID - Debug organization lookup (NEW!)
- POST /analytics - Get enhanced analytics
  Body: { "tenantId": "id", "period": "7d" }
- GET /status - This status page

DEBUG USAGE:
curl https://database-worker.metabilityllc1.workers.dev/debug-org?phone=+1234567890&orgId=86851e15-2618-4105-93be-0bfb023f1aec

TEST VOICE AGENT INTEGRATION:
curl -X POST https://database-worker.metabilityllc1.workers.dev/identify \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "+1234567890"}'

curl https://database-worker.metabilityllc1.workers.dev/config/86851e15-2618-4105-93be-0bfb023f1aec

curl "https://database-worker.metabilityllc1.workers.dev/organization/faqs?organizationId=86851e15-2618-4105-93be-0bfb023f1aec"

FAQ FEATURES:
🔍 Smart FAQ matching with keyword scoring
📊 FAQ usage tracking and analytics
🎯 Intent-based interaction logging
📈 Enhanced analytics with FAQ match rates

VOICE AGENT INTEGRATION:
🎤 Organization identification by business phone
⚙️ Configuration management for voice settings
❓ FAQ integration for intelligent responses
📊 Enhanced logging with cache tracking

Worker URL: ${request.url}

Database Tables Used:
- customers (id, phone, tenant_id, name, total_interactions, last_contact_date, status)
- interactions (id, tenant_id, customer_id, customer_phone, speech_input, ai_response, processing_time_ms, channel, intent, faq_matched, faq_id, used_cache, created_at)
- faqs (id, company_id/organization_id/tenant_id, keywords, response, question, category, usage_count, audio_url)
- organizations (id, name, phone/business_phone, elevenlabs_voice_id)
- tenant_configs (organization_id, business_name, business_phone, elevenlabs_voice_id)
      `, {
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      });
    }

    return new Response('Not Found', { 
      status: 404, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Database worker error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
}

// Main export
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};