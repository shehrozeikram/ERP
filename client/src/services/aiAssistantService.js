import api from './api';

const aiAssistantService = {
  /**
   * Natural-language document search.
   * @param {string} query
   * @param {{ limit?: number }} [options]
   */
  ask: async (query, options = {}) => {
    const response = await api.post('/ai/assistant', {
      query,
      limit: options.limit
    });
    return response.data;
  }
};

export default aiAssistantService;
