/**
 * If the assignment records a campaign send but no matching outgoing row exists yet
 * (e.g. legacy sends before persistence), add a read-only stub so "View replies" still shows it.
 */
export function mergeCampaignStubIntoMessages(assignmentRow, messages) {
  const list = Array.isArray(messages) ? [...messages] : [];
  if (!assignmentRow?.lastCampaignSentAt || !assignmentRow?.lastCampaignName) {
    return list.sort((a, b) => new Date(a.time) - new Date(b.time));
  }
  const campaignName = String(assignmentRow.lastCampaignName).trim();
  if (!campaignName) {
    return list.sort((a, b) => new Date(a.time) - new Date(b.time));
  }
  const hasAlready = list.some((m) => {
    if (m.direction !== 'out') return false;
    const txt = String(m.text || '');
    return txt.includes('[Campaign]') && txt.includes(campaignName.slice(0, 80));
  });
  if (hasAlready) return list.sort((a, b) => new Date(a.time) - new Date(b.time));
  list.push({
    _id: `stub-campaign-${assignmentRow._id}`,
    direction: 'out',
    time: assignmentRow.lastCampaignSentAt,
    text: `[Campaign] ${campaignName}`,
    status: 'sent',
    isCampaignStub: true
  });
  return list.sort((a, b) => new Date(a.time) - new Date(b.time));
}
