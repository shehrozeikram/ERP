import api from './api';

const BASE = '/taj-residencia/land-acquisition';

export const getMapStatus = async () => {
  const response = await api.get(`${BASE}/map-status`);
  return response.data;
};

export const getPartyKhasras = async (partyId) => {
  const response = await api.get(`${BASE}/map-status/party-khasras/${partyId}`);
  return response.data;
};

const landAcquisitionMapService = { getMapStatus, getPartyKhasras };

export default landAcquisitionMapService;
