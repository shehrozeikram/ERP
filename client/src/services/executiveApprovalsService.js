import api from './api';

const executiveApprovalsService = {
  getMyApprovals: () => api.get('/executive/my-approvals'),
  getMe: () => api.get('/executive/me')
};

export default executiveApprovalsService;
