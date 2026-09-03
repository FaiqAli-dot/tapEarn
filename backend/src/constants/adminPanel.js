/** Shared admin-panel JWT claim — kept separate to avoid auth ↔ service circular imports. */
export const ADMIN_PANEL_TOKEN_TYPE = 'admin-panel';

export function isAdminPanelToken(decoded) {
  return Boolean(
    decoded &&
    decoded.type === ADMIN_PANEL_TOKEN_TYPE &&
    decoded.panelUserId
  );
}
