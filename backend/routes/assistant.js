const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { Door, Gate, Motor, ControlSystem } = require('../models/Product');
const path = require('path');
const fs = require('fs').promises;
const PDFParser = require('../utils/pdfParser');
const vectorStore = require('../utils/vectorStore');

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
    
    // Remove the base URL part and get just the filename
    const filename = path.basename(manualUrl);
    const manualPath = path.join(__dirname, '../public/manuals', filename);
    
    // First, try to find relevant content from vector store
    if (query) {
      const searchResults = await vectorStore.search(query, 3);
      if (searchResults.length > 0) {
        return searchResults.map(result => {
          const { text, metadata } = result;
          return `[Pages ${metadata.pageStart}-${metadata.pageEnd}]: ${text}`;
        }).join('\n\n');
      }
    }

    // If no query or no results, extract text from PDF
    const pdfContent = await PDFParser.extractText(manualPath);
    
    // Store the content in vector store for future queries
    const sections = await PDFParser.extractPages(manualPath);
    for (const section of sections) {
      await vectorStore.addManualSection(
        section.text,
        filename,
        { start: section.pageNumber, end: section.pageNumber }
      );
    }

    return `Manual '${filename}' content has been processed. You can now ask specific questions about its contents.`;
  } catch (error) {
    console.error('Error accessing manual:', error);
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
      manualUrl, 
      highlightedText,
      previousMessages = []
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get product context and manual content
    const productContext = productId ? await getProductContext(productId, productType) : null;
    const manualContent = manualUrl ? await getManualContent(manualUrl, message) : '';

    // Build the system message with all available context
    let systemContent = BASE_SYSTEM_PROMPT;
    if (productContext) {
      systemContent += `\n\nProduct Context:\n${Object.values(productContext).filter(Boolean).join('\n')}`;
    }
    if (manualContent) {
      systemContent += `\n\nRelevant Manual Content:\n${manualContent}`;
    }
    if (highlightedText) {
      systemContent += `\n\nUser has highlighted this text from the manual:\n"${highlightedText}"`;
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