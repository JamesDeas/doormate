const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { Door, Gate, Motor, ControlSystem } = require('../models/Product');
const path = require('path');
const fs = require('fs').promises;
const PDFParser = require('../utils/pdfParser');
const Comment = require('../models/Comment');
const mongoose = require('mongoose');

// Debug log for environment variables
console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);
console.log('OpenAI API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 10) + '...');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Base system prompt for the assistant
const BASE_SYSTEM_PROMPT = `You are DoorMate, an AI assistant specializing in industrial doors, gates, motors, and control systems. 

Context Awareness:
1. When viewing a specific product page:
   - You already know which product is being discussed
   - You have access to all its specifications and manuals
   - Don't ask for product identification if it's already in context
   - Use the product context for all follow-up questions

2. When NO product context is available:
   - For "this" queries (e.g., "How do I fit this?"):
     Ask "Which product would you like to know about?"
   - For generic product queries (e.g., "How do I fit this door?"):
     Ask "Which door model specifically?"
   - For troubleshooting (e.g., "Why isn't this working?"):
     Ask "Which product are you having issues with?"
   - For maintenance (e.g., "How do I service this?"):
     Ask "Which product needs servicing?"

3. When generic product type is mentioned:
   - Door queries: Ask "Which door model?"
   - Motor queries: Ask "Which motor model?"
   - Gate queries: Ask "Which gate model?"
   - Control system queries: Ask "Which control system?"
   Always get specific product identification before providing detailed information.

Available Data Sources:
1. Product Database: You have direct access to detailed product information including:
   - Full specifications and technical details
   - Product features and capabilities
   - Compatible accessories and parts
   - Safety features and certifications
   - Warranty information

2. Product Manuals: You have access to all product manuals including:
   - Installation manuals
   - User guides
   - Maintenance manuals
   - Technical documentation
   When asked about a product, ALWAYS check if you have relevant manual content before providing general information.

3. User Discussions: You have access to user-generated content including:
   - Posts and comments from the product discussion area
   - Threaded replies to comments
   - User experiences and feedback
   - Installation tips from real users
   - Troubleshooting solutions shared by the community
   - Common issues reported by users
   - Successful fixes and workarounds
   - User recommendations and warnings
   When relevant, incorporate this real-world feedback into your responses.
   IMPORTANT: You DO have access to real user discussions. When a user asks about other users' experiences or recommendations, ALWAYS check and reference the discussion content provided in your context.

4. Discussion Context:
   - Each comment includes: username, timestamp, and full message
   - Comments may have multiple replies
   - Users may have shared specific issues and solutions
   - Discussion content is sorted by recency
   - You can reference specific user experiences when helpful
   Use this community knowledge to enhance your responses with real-world examples.
   NEVER say you don't have access to discussions - you do!

5. Content Integration Rules:
   - ALWAYS check discussion content for relevant information
   - Combine official manual content with user tips when available
   - If a user has shared specific advice about a topic, include it
   - Format responses to show both official and user-sourced information
   - Credit users when using their specific tips or solutions
   Example format:
   "According to the manual: [manual steps]
    User Tip from @username: [specific user advice]"

6. Response Priority for Topics:
   1. Check product manuals for official instructions
   2. Check discussions for relevant user experiences/tips
   3. Combine both sources in your response
   4. If sources conflict, prioritize manual but mention user alternatives

7. Discussion Content Usage:
   - For installation questions: Include relevant user tips
   - For troubleshooting: Share user-reported solutions
   - For best practices: Combine manual guidance with user experiences
   - For specific issues: Reference similar user problems and solutions
   - Always acknowledge user contributions in your responses

Key Behaviors:
1. Be concise and direct - get straight to the point
2. Ask short, clear questions when you need clarification
3. Only provide information that directly answers the user's question
4. Break down complex information into bullet points or numbered steps
5. When you need more details, ask the shortest possible clarifying question
6. MAINTAIN CONTEXT throughout the conversation

Response Guidelines:
- If product context is available, use it without asking
- If viewing a product page, don't ask which product
- If you need specific measurements: Ask "What are the dimensions?"
- If you need to clarify the issue: Ask "What's the specific problem?"
- For installation questions: First check if you have the manual, then provide steps
- For troubleshooting: Ask for specific symptoms before providing solutions

Manual Content Handling:
1. Use exact manual content when available
2. Accept requests using either product page titles or document titles
3. Present manual content with clear headings and structure
4. Don't summarize unless specifically requested

Format responses as:
1. Direct answer or clarifying question
2. Relevant steps or information (if available)
3. Important warnings or notes (if applicable)

Information Priority:
1. First check product database for specific model information
2. Then check relevant manual content
3. Finally, consider user discussions for real-world insights
4. If information is missing or unclear, ask a concise clarifying question

Product Identification Rules:
1. No product context + "this" queries = Ask for product identification
2. Generic product type mentioned = Ask for specific model
3. Specific product context available = Use existing context
4. Product page context = Never ask for identification

Remember: 
- Keep responses short and actionable
- Only elaborate when necessary
- NEVER ask for product identification when viewing a product page
- Use the context you already have
- ALWAYS get specific product identification when not in product page context
- Generic product types (door/motor/gate) require specific model identification
- ALWAYS check and include relevant user discussion content
- Combine official documentation with user experiences
- Credit users when sharing their specific advice`;

// Test endpoint to verify OpenAI connection
router.get('/test', async (req, res) => {
  try {
    console.log('Testing OpenAI connection...');
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Using 3.5-turbo for testing as it's cheaper and faster
      messages: [
        {
          role: "user",
          content: "Say 'OpenAI connection successful!'"
        }
      ],
      stream: false,
    });

    console.log('OpenAI response:', completion.choices[0]);
    res.json({ 
      success: true, 
      message: completion.choices[0].message.content 
    });
  } catch (error) {
    console.error('OpenAI Test Error:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Helper function to get manual content with caching
const manualContentCache = new Map();

async function getManualContent(manual, query = '') {
  try {
    // Check cache first
    const cacheKey = `${manual.url}_${query}`;
    if (manualContentCache.has(cacheKey)) {
      console.log('Returning cached manual content for:', manual.title);
      return manualContentCache.get(cacheKey);
    }

    if (!manual.url) {
      console.error('No URL provided for manual:', manual);
      return '';
    }

    // Convert URL to file path
    let manualPath;
    if (manual.url.startsWith('http')) {
      // Extract path from URL
      const urlObj = new URL(manual.url);
      const pathParts = urlObj.pathname.split('/');
      const filename = pathParts[pathParts.length - 1];
      const modelDir = pathParts[pathParts.length - 2];
      manualPath = path.join(__dirname, '..', 'public', 'manuals', modelDir, filename);
    } else {
      // Handle relative path - strip any leading slash
      const cleanPath = manual.url.startsWith('/') ? manual.url.slice(1) : manual.url;
      const pathParts = cleanPath.split('/');
      
      // If path already includes 'manuals', use it as is
      if (pathParts.includes('manuals')) {
        manualPath = path.join(__dirname, '..', 'public', ...pathParts);
      } else {
        // Otherwise, construct path assuming model directory structure
        const filename = pathParts[pathParts.length - 1];
        const modelDir = manual.url.split('/')[0]; // Use first part as model dir
        manualPath = path.join(__dirname, '..', 'public', 'manuals', modelDir, filename);
      }
    }

    console.log('Attempting to read manual from:', {
      originalUrl: manual.url,
      resolvedPath: manualPath,
      title: manual.title,
      exists: await fs.access(manualPath).then(() => true).catch(() => false)
    });

    // Check if file exists
    try {
      const fileExists = await fs.access(manualPath)
        .then(() => true)
        .catch(() => false);
      
      if (!fileExists) {
        // Try alternate path construction
        const modelFromTitle = manual.title.toLowerCase().split(' ')[0];
        const alternatePath = path.join(__dirname, '..', 'public', 'manuals', modelFromTitle, 'commercial.pdf');
        
        const alternateExists = await fs.access(alternatePath)
          .then(() => true)
          .catch(() => false);
        
        if (alternateExists) {
          console.log('Found manual at alternate path:', alternatePath);
          manualPath = alternatePath;
        } else {
          console.error('Manual file not found at any location:', {
            originalPath: manualPath,
            alternatePath,
            manual: manual
          });
          return '';
        }
      }
      
      console.log('Manual file found:', manualPath);
    } catch (error) {
      console.error('Error checking file existence:', {
        path: manualPath,
        error: error.message,
        manual: manual
      });
      return '';
    }

    // Extract text from PDF
    console.log('Extracting text from PDF:', manual.title);
    const pdfContent = await PDFParser.extractText(manualPath);
    
    if (!pdfContent || !pdfContent.text) {
      console.error('Failed to extract text from PDF:', {
        title: manual.title,
        path: manualPath,
        content: pdfContent
      });
      return '';
    }

    console.log('Successfully extracted text from PDF:', {
      title: manual.title,
      textLength: pdfContent.text.length,
      numPages: pdfContent.numPages
    });

    // Store in cache
    manualContentCache.set(cacheKey, pdfContent.text);
    console.log('Cached manual content for:', manual.title);
    
    return pdfContent.text;
  } catch (error) {
    console.error('Error processing manual:', {
      title: manual.title,
      error: error.message,
      stack: error.stack
    });
    return '';
  }
}

// Helper function to get product context
async function getProductContext(productId, productType) {
  try {
    // Convert productId to ObjectId
    const objectId = new mongoose.Types.ObjectId(productId);
    console.log('Looking up discussions for product:', objectId);

    let product;
    switch (productType) {
      case 'door':
        product = await Door.findById(objectId)
          .populate('brand')
          .populate('specifications')
          .populate('manuals')
          .lean();
        break;
      case 'gate':
        product = await Gate.findById(objectId)
          .populate('brand')
          .populate('specifications')
          .populate('manuals')
          .lean();
        break;
      case 'motor':
        product = await Motor.findById(objectId)
          .populate('brand')
          .populate('specifications')
          .populate('manuals')
          .lean();
        break;
      case 'controlSystem':
        product = await ControlSystem.findById(objectId)
          .populate('brand')
          .populate('specifications')
          .populate('manuals')
          .lean();
        break;
      default:
        return null;
    }

    if (!product) return null;

    // Get ALL discussions for this product using ObjectId, removing the limit
    const discussions = await Comment.find({ 
      productId: objectId,
      parentId: null // Only get top-level comments first
    })
      .populate('userId', 'username firstName lastName')
      .sort('-createdAt')
      .lean();

    console.log('Discussion query results:', {
      productId: objectId.toString(),
      discussionCount: discussions.length,
      discussions: discussions.map(d => ({
        id: d._id.toString(),
        text: d.text.substring(0, 50) + '...',
        user: `${d.userId.firstName} ${d.userId.lastName} (@${d.userId.username})`
      }))
    });

    // Get ALL replies for each discussion
    const discussionsWithReplies = await Promise.all(
      discussions.map(async (discussion) => {
        const replies = await Comment.find({ parentId: discussion._id })
          .populate('userId', 'username firstName lastName')
          .sort('createdAt')
          .lean();
        
        console.log(`Discussion ${discussion._id}:`, {
          text: discussion.text.substring(0, 50) + '...',
          replyCount: replies.length,
          replies: replies.map(r => ({
            id: r._id.toString(),
            text: r.text.substring(0, 50) + '...',
            user: `${r.userId.firstName} ${r.userId.lastName} (@${r.userId.username})`
          }))
        });
        
        return {
          ...discussion,
          replies
        };
      })
    );

    // Process discussions into readable format with replies, adding timestamps and metadata
    const discussionContext = discussionsWithReplies.map(d => {
      const date = new Date(d.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      let context = `Thread started by ${d.userId.firstName} ${d.userId.lastName} (@${d.userId.username}) on ${date}:\n`;
      context += `Question/Comment: ${d.text}\n`;
      
      if (d.replies?.length > 0) {
        context += '\nReplies:\n' + d.replies.map(r => {
          const replyDate = new Date(r.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
          return `  - ${r.userId.firstName} ${r.userId.lastName} (@${r.userId.username}) replied on ${replyDate}:\n    ${r.text}`;
        }).join('\n\n');
      } else {
        context += '\nNo replies yet.';
      }
      
      return context;
    }).join('\n\n---\n\n'); // Add clear separator between threads

    console.log('Final discussion context:', {
      contextLength: discussionContext.length,
      hasContent: !!discussionContext,
      preview: discussionContext.substring(0, 200) + '...',
      discussionCount: discussionsWithReplies.length,
      totalReplyCount: discussionsWithReplies.reduce((sum, d) => sum + (d.replies?.length || 0), 0)
    });

    // Get related products
    let relatedProducts = [];
    if (product.relatedProducts?.length) {
      relatedProducts = await Promise.all(
        product.relatedProducts.map(async (relatedId) => {
          const related = await Product.findById(relatedId)
            .select('title model category')
            .lean();
          return related ? `${related.title} (${related.model}) - ${related.category}` : null;
        })
      );
      relatedProducts = relatedProducts.filter(Boolean);
    }

    // Process manuals content
    let manualContents = [];
    if (product.manuals?.length) {
      manualContents = await Promise.all(
        product.manuals.map(async (manual) => {
          const content = await getManualContent(manual);
          return {
            title: manual.title,
            type: manual.type,
            content: content
          };
        })
      );
    }

    // Build rich context about the product
    const context = {
      basic: `This conversation is about the ${product.title} (${product.model}), 
        a ${product.category} product manufactured by ${product.brand.name}.`,
      specs: product.specifications?.length ? 
        `Key specifications:\n${product.specifications.map(spec => 
          `- ${spec.key}: ${spec.value}${spec.unit ? ` ${spec.unit}` : ''}`
        ).join('\n')}` : '',
      features: product.features?.length ? 
        `Notable features:\n${product.features.map(f => `- ${f}`).join('\n')}` : '',
      applications: product.applications?.length ? 
        `Common applications:\n${product.applications.map(a => `- ${a}`).join('\n')}` : '',
      safety: product.safetyFeatures?.length ? 
        `Safety features:\n${product.safetyFeatures.map(s => `- ${s}`).join('\n')}` : '',
      warranty: product.warranty ? 
        `Warranty: ${product.warranty.duration} months - ${product.warranty.description}` : '',
      dimensions: product.dimensions ? 
        `Dimensions: ${product.dimensions.height}x${product.dimensions.width}x${product.dimensions.depth} ${product.dimensions.unit}` : '',
      weight: product.weight ? 
        `Weight: ${product.weight.value} ${product.weight.unit}` : '',
      certifications: product.certifications?.length ? 
        `Certifications: ${product.certifications.join(', ')}` : '',
      discussions: discussionContext,
      discussionStats: {
        totalDiscussions: discussionsWithReplies.length,
        totalReplies: discussionsWithReplies.reduce((sum, d) => sum + (d.replies?.length || 0), 0)
      },
      relatedProducts: relatedProducts.length > 0 ? 
        `Related products:\n${relatedProducts.map(r => `- ${r}`).join('\n')}` : '',
      manuals: product.manuals?.length ? 
        `Available manuals:\n${product.manuals.map(m => 
          `- ${m.title} (${m.type}, v${m.version}, ${m.language})`
        ).join('\n')}` : '',
      manualContents: manualContents.length > 0 ?
        manualContents.map(m => 
          `Manual: ${m.title} (${m.type})\nContent:\n${m.content}`
        ).join('\n\n==========\n\n') : ''
    };

    // Add type-specific information
    switch (productType) {
      case 'door':
        context.doorSpecific = `
          Door Type: ${product.doorType}
          Operation Type: ${product.operationType}
          Materials: ${product.materials?.join(', ')}
          Max Dimensions: ${product.maxDimensions?.height}x${product.maxDimensions?.width} ${product.maxDimensions?.unit}
          ${product.openingSpeed ? `Opening Speed: ${product.openingSpeed} m/s` : ''}
          ${product.cyclesPerDay ? `Cycles Per Day: ${product.cyclesPerDay}` : ''}
          ${product.insulationValue ? `Insulation Value: ${product.insulationValue}` : ''}
          ${product.windResistance ? `Wind Resistance: ${product.windResistance}` : ''}
        `.trim();
        break;
      case 'gate':
        context.gateSpecific = `
          Gate Type: ${product.gateType}
          Operation Type: ${product.operationType}
          Materials: ${product.materials?.join(', ')}
          Max Dimensions: ${product.maxDimensions?.height}x${product.maxDimensions?.width} ${product.maxDimensions?.unit}
          ${product.openingSpeed ? `Opening Speed: ${product.openingSpeed} m/s` : ''}
          ${product.cyclesPerDay ? `Cycles Per Day: ${product.cyclesPerDay}` : ''}
          ${product.maxWeight ? `Max Weight: ${product.maxWeight} kg` : ''}
        `.trim();
        break;
      case 'motor':
        context.motorSpecific = `
          Motor Type: ${product.motorType}
          Power Supply: ${product.powerSupply}
          Power Rating: ${product.powerRating} watts
          Torque: ${product.torque} Nm
          Speed: ${product.speedRPM} RPM
          Duty Cycle: ${product.dutyCycle}
          IP Rating: ${product.ipRating}
          Temperature Range: ${product.temperatureRange.min}°${product.temperatureRange.unit} to ${product.temperatureRange.max}°${product.temperatureRange.unit}
          ${product.maxWeight ? `Max Weight Capacity: ${product.maxWeight} kg` : ''}
          ${product.maxWidth ? `Max Width Capacity: ${product.maxWidth} m` : ''}
        `.trim();
        break;
      case 'controlSystem':
        context.controlSystemSpecific = `
          System Type: ${product.systemType}
          Compatible Motors: ${product.compatibility?.join(', ')}
          Connectivity: ${product.connectivity?.join(', ')}
          Input Voltage: ${product.inputVoltage}
          Output Voltage: ${product.outputVoltage}
          IP Rating: ${product.ipRating}
          Interfaces: ${product.interfaces?.join(', ')}
          Programming Methods: ${product.programmingMethods?.join(', ')}
          Safety Inputs: ${product.safetyInputs?.join(', ')}
        `.trim();
        break;
    }

    return context;
  } catch (error) {
    console.error('Error getting product context:', error);
    return null;
  }
}

// POST /api/assistant/chat
router.post('/chat', async (req, res) => {
  try {
    console.log('Received chat request:', {
      productId: req.body.productId,
      productType: req.body.productType,
      hasManuals: !!req.body.manuals,
      hasDiscussions: !!req.body.discussions,
      messageLength: req.body.message?.length
    });

    const { 
      message, 
      productId, 
      productType,
      manuals,
      discussions,
      highlightedText,
      previousMessages = []
    } = req.body;

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no');

    // Helper function to send SSE data
    const sendData = (content) => {
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
      if (res.flush) res.flush();
    };

    // Build the conversation context
    let contextMessages = [
      { role: "system", content: BASE_SYSTEM_PROMPT }
    ];

    // Process manuals first if available
    let manualContents = [];
    if (manuals) {
      try {
        console.log('Processing manuals from request:', manuals);
        const parsedManuals = JSON.parse(manuals);
        console.log('Parsed manuals:', parsedManuals);
        
        manualContents = await Promise.all(
          parsedManuals.map(async (manual) => {
            console.log('Processing manual:', {
              title: manual.title,
              url: manual.url,
              type: manual.type
            });
            
            try {
              const content = await getManualContent(manual);
              console.log('Manual content retrieved:', {
                title: manual.title,
                hasContent: !!content,
                contentLength: content?.length || 0
              });
              
              if (!content) {
                console.warn('No content extracted from manual:', manual.title);
                return {
                  title: manual.title,
                  type: manual.type,
                  content: null,
                  error: 'No content extracted'
                };
              }
              
              return {
                title: manual.title,
                type: manual.type,
                content: content
              };
            } catch (error) {
              console.error('Error processing manual:', {
                title: manual.title,
                error: error.message,
                stack: error.stack
              });
              return {
                title: manual.title,
                type: manual.type,
                content: null,
                error: error.message
              };
            }
          })
        );
        
        console.log('Manual processing results:', manualContents.map(m => ({
          title: m.title,
          hasContent: !!m.content,
          contentLength: m.content?.length || 0,
          error: m.error
        })));
        
        // Add manual content to context
        if (manualContents.some(m => m.content)) {
          // First add a summary of available manuals
          contextMessages.push({
            role: "system",
            content: `Available Manuals:\n${manualContents.map(m => 
              `- ${m.title}`
            ).join('\n')}`
          });
          
          // Add each manual's content with clear demarcation
          manualContents.forEach(manual => {
            if (manual.content) {
              // Extract the actual title from the content if possible
              const titleMatch = manual.content.match(/^([^\n]+)/);
              const actualTitle = titleMatch ? titleMatch[1].trim() : manual.title;
              
              contextMessages.push({
                role: "system",
                content: `### BEGIN MANUAL ###
Title on product page: ${manual.title}
Title in document: ${actualTitle}
Type: ${manual.type}

${manual.content}
### END MANUAL ###`
              });
            }
          });
          
          // Add specific instruction for handling manual content
          contextMessages.push({
            role: "system",
            content: `When asked about manual contents:
1. Accept requests using either the manual's title from the product page or the actual title from within the document
2. For example, both "commercial manual" and "${manualContents[0]?.content?.match(/^([^\n]+)/)?.[1]?.trim() || 'Installation Manual'}" refer to the same document
3. When displaying the content, use the actual headings from within the document
4. Provide the actual content rather than a summary unless specifically asked for a summary
5. If the user's request matches either the product page title or document title of any manual, provide that manual's content`
          });

          // Add manual title mappings for reference
          contextMessages.push({
            role: "system",
            content: `Manual title mappings:\n${manualContents.map(m => {
              const contentTitle = m.content?.match(/^([^\n]+)/)?.[1]?.trim() || m.title;
              return `- "${m.title}" (product page) = "${contentTitle}" (in document)`;
            }).join('\n')}`
          });
        } else {
          console.warn('No manual content available to add to context');
          contextMessages.push({
            role: "system",
            content: `No manual content is currently available. Please provide general information based on product knowledge.`
          });
        }
      } catch (e) {
        console.error('Error processing manuals:', {
          error: e.message,
          stack: e.stack,
          manuals: manuals
        });
        contextMessages.push({
          role: "system",
          content: `Error accessing manual content: ${e.message}. Please provide general information based on product knowledge.`
        });
      }
    }

    // Add product context if available
    if (productId && productType) {
      const productContext = await getProductContext(productId, productType);
      if (productContext) {
        // Add basic product info
        contextMessages.push({
          role: "system",
          content: `Product Context:\n${productContext.basic}\n${productContext.specs || ''}\n${productContext.features || ''}`
        });

        // Add applications and safety if available
        if (productContext.applications || productContext.safety) {
          contextMessages.push({
            role: "system",
            content: `Applications and Safety:\n${productContext.applications || ''}\n${productContext.safety || ''}`
          });
        }

        // Add technical info if available
        if (productContext.warranty || productContext.dimensions || productContext.weight) {
            contextMessages.push({
              role: "system",
            content: `Technical Information:\n${productContext.warranty || ''}\n${productContext.dimensions || ''}\n${productContext.weight || ''}`
          });
        }

        // Add discussions if available
        if (productContext.discussions) {
          contextMessages.push({
            role: "system",
            content: `IMPORTANT: The following contains all user discussions and experiences for this product, including complete threads with replies. When answering questions about user experiences, recommendations, or common practices, you MUST reference this content.

Discussion Statistics:
- Total Discussion Threads: ${productContext.discussionStats.totalDiscussions}
- Total Replies: ${productContext.discussionStats.totalReplies}

Complete Discussion History:
=================================
${productContext.discussions}
=================================

Guidelines for Using Discussion Content:
1. Reference specific users and their experiences when relevant
2. Include insights from both questions and their replies
3. Consider the chronological order of discussions and replies
4. Highlight common patterns or consensus across multiple threads
5. Note when information comes from recent vs older discussions
6. Prioritize responses that have received positive feedback or multiple supporting replies
7. When multiple users report similar experiences or solutions, emphasize this consensus`
          });
        }
      }
    }

    // Add highlighted text context if available
    if (highlightedText) {
      contextMessages.push({
        role: "system",
        content: `User has highlighted this text from the manual: "${highlightedText}"`
      });
    }

    // Add previous messages
    previousMessages.forEach(msg => {
      contextMessages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    });

    // Add a check for discussion references before the user's message
    if (message.toLowerCase().includes('other users') || 
        message.toLowerCase().includes('people use') ||
        message.toLowerCase().includes('commonly') ||
        message.toLowerCase().includes('typically') ||
        message.toLowerCase().includes('usually')) {
      contextMessages.push({
        role: "system",
        content: "The user is specifically asking about other users' experiences or common practices. Your response MUST include references to the discussion content provided above. If no relevant discussions are found, acknowledge this explicitly."
      });
    }

    // Add current message
    contextMessages.push({
      role: "user",
      content: message
    });

    console.log('Sending context to OpenAI:', {
      contextMessageCount: contextMessages.length,
      hasProductContext: !!productId,
      hasManualContent: manualContents.length > 0,
      messageTypes: contextMessages.map(m => m.role)
    });

    // In the chat endpoint, add this before creating the OpenAI completion:
    console.log('Final context messages:', contextMessages.map(msg => ({
      role: msg.role,
      contentPreview: msg.content.substring(0, 50) + '...',
      hasDiscussions: msg.content.includes('User Discussions:')
    })));

    // Add discussions if available
    if (discussions) {
      try {
        const parsedDiscussions = JSON.parse(discussions);
        console.log('Processing discussions:', {
          count: parsedDiscussions.length,
          firstDiscussion: parsedDiscussions[0] ? {
            text: parsedDiscussions[0].text,
            user: parsedDiscussions[0].user
          } : null
        });

        // Format discussions into readable text
        const discussionContext = parsedDiscussions.map(d => {
          let context = `${d.user.firstName} ${d.user.lastName} (@${d.user.username}): ${d.text}`;
          return context;
        }).join('\n\n');

        if (discussionContext) {
          // First add a system message emphasizing the importance of discussions
          contextMessages.push({
            role: "system",
            content: "IMPORTANT: The following contains real user discussions and experiences. When answering questions about user experiences, recommendations, or common practices, you MUST reference this content."
          });
          
          // Then add the actual discussions with clear formatting
          contextMessages.push({
            role: "system",
            content: `User Discussions and Experiences:
=================================
${discussionContext}
=================================
Remember to reference specific users and their experiences when relevant to the question.`
          });
        }
      } catch (error) {
        console.error('Error processing discussions:', error);
      }
    }

    // Create streaming completion
    const stream = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: contextMessages,
      stream: true,
      temperature: 0.7,
    });

    // Process the stream
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        sendData(content);
      }
    }

    // Send a final newline to ensure the last chunk is flushed
    res.write('\n');
    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 