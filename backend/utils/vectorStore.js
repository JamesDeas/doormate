const { ChromaClient, OpenAIEmbeddingFunction } = require('chromadb');
const crypto = require('crypto');

class VectorStore {
  constructor() {
    this.client = new ChromaClient();
    this.embedder = new OpenAIEmbeddingFunction({
      openai_api_key: process.env.OPENAI_API_KEY
    });
    this.collection = null;
  }

  async initialize() {
    try {
      // Create or get collection for manuals
      this.collection = await this.client.getOrCreateCollection({
        name: "manuals",
        embeddingFunction: this.embedder
      });
    } catch (error) {
      console.error('Error initializing vector store:', error);
      throw new Error(`Failed to initialize vector store: ${error.message}`);
    }
  }

  generateId(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  async addDocument(text, metadata = {}) {
    try {
      if (!this.collection) await this.initialize();

      const id = this.generateId(text);
      await this.collection.add({
        ids: [id],
        documents: [text],
        metadatas: [metadata]
      });

      return id;
    } catch (error) {
      console.error('Error adding document:', error);
      throw new Error(`Failed to add document: ${error.message}`);
    }
  }

  async addManualSection(text, manualId, pageNumbers, section = '') {
    return this.addDocument(text, {
      type: 'manual',
      manualId,
      pageStart: pageNumbers.start,
      pageEnd: pageNumbers.end,
      section
    });
  }

  async search(query, limit = 5) {
    try {
      if (!this.collection) await this.initialize();

      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit
      });

      return results.documents[0].map((doc, i) => ({
        text: doc,
        metadata: results.metadatas[0][i],
        distance: results.distances[0][i]
      }));
    } catch (error) {
      console.error('Error searching documents:', error);
      throw new Error(`Failed to search documents: ${error.message}`);
    }
  }

  async deleteManual(manualId) {
    try {
      if (!this.collection) await this.initialize();

      const ids = await this.collection.get({
        where: {
          type: 'manual',
          manualId: manualId
        }
      });

      if (ids.length > 0) {
        await this.collection.delete({
          ids: ids
        });
      }
    } catch (error) {
      console.error('Error deleting manual:', error);
      throw new Error(`Failed to delete manual: ${error.message}`);
    }
  }
}

module.exports = new VectorStore(); 