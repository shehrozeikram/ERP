import api from './api';

const BASE = '/taj-residencia/land-acquisition';

export const getMapStatus = () => api.get(`${BASE}/map-status`);
export const getPartyKhasras = (partyId) => api.get(`${BASE}/map-status/party-khasras/${partyId}`);

const landAcquisitionMapService = { getMapStatus, getPartyKhasras };

export default landAcquisitionMapService;
