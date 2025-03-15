const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { Door, Gate, Motor, ControlSystem } = require('../models/Product');
const path = require('path');
const fs = require('fs').promises;
const PDFParser = require('../utils/pdfParser');

// Debug log for environment variables
console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);
console.log('OpenAI API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 10) + '...');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Base system prompt for the assistant
const BASE_SYSTEM_PROMPT = `You are DoorMate, an AI assistant specializing in industrial doors, gates, motors, and control systems. 
Your primary role is to help door engineers and technicians with:
1. Installation guidance
2. Maintenance procedures
3. Troubleshooting issues
4. Technical specifications
5. Safety requirements and regulations

Key behaviors:
- Always provide practical, actionable advice
- Reference specific manual sections when possible
- Include safety warnings where relevant
- If you're unsure about any technical detail, say so rather than guessing
- Focus only on door/gate related queries, politely decline other topics
- Use technical language but explain complex terms
- Format responses with clear steps and bullet points for better readability

You have access to product manuals and specifications. When providing advice:
- Cite specific manual sections
- Reference relevant safety standards
- Include model-specific details when available
- Suggest when professional inspection might be needed`;

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

// Helper function to get product context
async function getProductContext(productId, productType) {
  try {
    let product;
    switch (productType) {
      case 'door':
        product = await Door.findById(productId);
        break;
      case 'gate':
        product = await Gate.findById(productId);
        break;
      case 'motor':
        product = await Motor.findById(productId);
        break;
      case 'controlSystem':
        product = await ControlSystem.findById(productId);
        break;
      default:
        return null;
    }

    if (!product) return null;

    // Build rich context about the product
    const context = {
      basic: `This conversation is about the ${product.name} (${product.model}), 
        a ${product.category} product manufactured by ${product.brand.name}.`,
      specs: `Key specifications: ${JSON.stringify(product.specifications)}`,
      features: product.features ? `Notable features: ${product.features.join(', ')}` : '',
      applications: product.applications ? `Common applications: ${product.applications.join(', ')}` : '',
      safety: product.safetyFeatures ? `Safety features: ${product.safetyFeatures.join(', ')}` : '',
      manuals: product.manuals ? `Available manuals: ${product.manuals.map(m => m.title).join(', ')}` : ''
    };

    return context;
  } catch (error) {
    console.error('Error getting product context:', error);
    return null;
  }
}

// Helper function to get manual content
async function getManualContent(manualUrl, query = '') {
  try {
    if (!manualUrl) return '';
    
    // Handle both full URLs and local paths
    const urlParts = manualUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // Get all parts after 'manuals/' to preserve subdirectory structure
    const manualsIndex = urlParts.indexOf('manuals');
    const pathAfterManuals = urlParts.slice(manualsIndex + 1).join('/');
    
    // Construct the full path including subdirectory structure
    const manualPath = path.join(process.cwd(), 'public/manuals', pathAfterManuals);
    
    console.log('Attempting to read manual from:', manualPath);
    
    // Check if file exists
    try {
      await fs.access(manualPath);
    } catch (error) {
      console.error('Manual file not found:', manualPath);
      return `Error: Manual file not found at ${manualPath}`;
    }

    // Extract text from PDF
    const pdfContent = await PDFParser.extractText(manualPath);
    
    // Clean and format the content
    const cleanContent = pdfContent.text
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();
    
    // First split by main sections (1., 2., etc.)
    const mainSections = cleanContent.split(/(?=\d+\.\s)/);
    
    // Process each main section and its subsections
    const processedSections = mainSections
      .map(section => {
        // Split section into title and content
        const match = section.match(/^(\d+\.\s+[^\n-]+)(.+)$/s);
        if (!match) return section.trim();
        
        const [_, title, content] = match;
        
        // Split content into bullet points
        const points = content
          .split('-')
          .filter(Boolean)
          .map(point => point.trim());
        
        // Format the section
        return `${title.trim()}\n${points.map(p => `  - ${p}`).join('\n')}`;
      })
      .filter(section => section.length > 0);

    // If there's a query, try to find relevant sections
    if (query) {
      const queryWords = query.toLowerCase().split(/\s+/);
      const relevantSections = processedSections.filter(section => {
        const sectionLower = section.toLowerCase();
        return queryWords.some(word => sectionLower.includes(word));
      });

      if (relevantSections.length > 0) {
        return relevantSections.join('\n\n');
      }
    }

    // If no query or no relevant sections found, return all sections
    return processedSections.join('\n\n');
  } catch (error) {
    console.error('Error processing manual:', error);
    return `Error processing manual: ${error.message}`;
  }
}

// POST /api/assistant/chat
router.post('/chat', async (req, res) => {
  try {
    console.log('Received chat request:', req.body);
    const { 
      message, 
      productId, 
      productType,
      manuals,
      highlightedText,
      previousMessages = []
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get product context and manual content
    const productContext = productId ? await getProductContext(productId, productType) : null;
    
    // Process all manuals if available
    let manualContents = '';
    if (manuals) {
      try {
        const parsedManuals = JSON.parse(manuals);
        console.log('Processing manuals:', parsedManuals);
        for (const manual of parsedManuals) {
          console.log(`Processing manual: ${manual.title} (${manual.url})`);
          const content = await getManualContent(manual.url, message);
          console.log(`Content received for ${manual.title}:`, content.substring(0, 100) + '...');
          if (content) {
            if (content.startsWith('Error:')) {
              console.error(`Error processing manual ${manual.title}:`, content);
              continue;
            }
            manualContents += `\n\n=== ${manual.title} ===\n${content}\n`;
          }
        }
      } catch (error) {
        console.error('Error processing manuals:', error);
      }
    }

    // Build the system message with all available context
    let systemContent = BASE_SYSTEM_PROMPT;
    if (productContext) {
      systemContent += `\n\nProduct Context:\n${Object.values(productContext).filter(Boolean).join('\n')}`;
    }
    if (manualContents) {
      systemContent += `\n\nManual Content:\nBelow are the sections from the product manuals. Each section contains specific information about installation, usage, or maintenance. The content is structured with main sections (1., 2., etc.) and bullet points for detailed steps.\n\nWhen answering questions, please:\n- Cite specific sections by their numbers (e.g., "Section 1" or "Section 3.2")\n- Quote relevant bullet points when providing detailed instructions\n- Maintain the original formatting and numbering in your responses\n\n${manualContents}`;
    }
    if (highlightedText) {
      systemContent += `\n\nHighlighted Text:\n"${highlightedText}"\n\nPlease focus on this specific section in your response.`;
    }

    // Prepare conversation messages
    const messages = [
      { role: "system", content: systemContent },
      ...previousMessages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      })),
      { role: "user", content: message }
    ];

    // Create chat completion
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
      stream: true,
      temperature: 0.7, // Balanced between creativity and accuracy
      max_tokens: 1000, // Reasonable length for detailed responses
    });

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream the response
    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.end();
  } catch (error) {
    console.error('Assistant API Error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause
    });
    
    res.status(500).json({ 
      error: 'Error processing request',
      details: error.message,
      type: error.name
    });
  }
});

module.exports = router; 