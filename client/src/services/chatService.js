import api from './api';

const unwrap = (res) => res.data?.data ?? res.data;

const ChatService = {
  async getUnreadSummary() {
    const res = await api.get('/chat/unread-summary');
    return unwrap(res).totalUnread ?? 0;
  },

  async getPresence(userIds) {
    if (!userIds || !userIds.length) return {};
    const res = await api.get('/chat/presence', { params: { ids: userIds.join(',') } });
    return unwrap(res).online || {};
  },

  async listConversations() {
    const res = await api.get('/chat/conversations');
    return unwrap(res).conversations || [];
  },

  async openConversation(otherUserId) {
    const res = await api.post('/chat/conversations/open', { otherUserId });
    return unwrap(res).conversation;
  },

  async createGroup(title, memberIds) {
    const res = await api.post('/chat/groups', { title, memberIds });
    return unwrap(res).conversation;
  },

  async updateGroupMembers(conversationId, addUserIds = [], removeUserIds = []) {
    const res = await api.post(`/chat/groups/${conversationId}/members`, { addUserIds, removeUserIds });
    return unwrap(res);
  },

  async getConversation(conversationId) {
    const res = await api.get(`/chat/conversations/${conversationId}`);
    return unwrap(res);
  },

  async listMessages(conversationId, { before, limit } = {}) {
    const res = await api.get(`/chat/conversations/${conversationId}/messages`, {
      params: { before, limit }
    });
    return unwrap(res);
  },

  async searchMessages(conversationId, q) {
    const res = await api.get(`/chat/conversations/${conversationId}/search`, { params: { q } });
    return unwrap(res).messages || [];
  },

  async sendMessage(conversationId, payload) {
    const res = await api.post(`/chat/conversations/${conversationId}/messages`, payload);
    return unwrap(res);
  },

  async markRead(conversationId, lastMessageId) {
    const res = await api.post(`/chat/conversations/${conversationId}/read`, { lastMessageId });
    return unwrap(res);
  },

  async editMessage(messageId, body) {
    const res = await api.patch(`/chat/messages/${messageId}`, { body });
    return unwrap(res).message;
  },

  async deleteMessage(messageId, scope = 'forEveryone') {
    const scopeParam = scope === 'forMe' ? 'for_me' : 'forEveryone';
    const res = await api.delete(`/chat/messages/${messageId}`, { params: { scope: scopeParam } });
    return unwrap(res);
  },

  async toggleReaction(messageId, emoji) {
    const res = await api.post(`/chat/messages/${messageId}/reactions`, { emoji });
    return unwrap(res);
  },

  async toggleStar(messageId) {
    const res = await api.post(`/chat/messages/${messageId}/star`);
    return unwrap(res);
  },

  async setPin(conversationId, messageId) {
    const res = await api.post(`/chat/conversations/${conversationId}/pin`, { messageId: messageId || null });
    return unwrap(res);
  },

  async directory(search = '', limit = 25) {
    const res = await api.get('/chat/directory', { params: { search, limit } });
    return unwrap(res).users || [];
  },

  async uploadAttachment(conversationId, file) {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post(`/chat/conversations/${conversationId}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return unwrap(res);
  },

  async exportConversation(conversationId) {
    const res = await api.get(`/chat/conversations/${conversationId}/export`, {
      responseType: 'blob'
    });
    return res.data;
  },

  async adminSearchMessages(q, limit = 40) {
    const res = await api.get('/chat/admin/messages', { params: { q, limit } });
    return unwrap(res).messages || [];
  },

  async adminForceDeleteMessage(messageId) {
    const res = await api.delete(`/chat/admin/messages/${messageId}/force`);
    return unwrap(res);
  }
};

export default ChatService;
