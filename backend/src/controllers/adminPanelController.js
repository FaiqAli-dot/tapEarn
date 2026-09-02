import {
  loginAdminPanel,
  changeAdminPanelCredentials
} from '../services/adminPanelService.js';

export async function adminPanelLogin(req, res) {
  try {
    const { username, password } = req.body || {};
    const result = await loginAdminPanel(username, password);
    res.json({ success: true, ...result });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
}

export async function adminPanelChangeCredentials(req, res) {
  try {
    const panelUserId = req.auth?.panelUserId;
    if (!panelUserId) {
      return res.status(401).json({
        success: false,
        error: 'Admin panel authentication required'
      });
    }

    const { currentPassword, newUsername, newPassword } = req.body || {};
    const result = await changeAdminPanelCredentials(panelUserId, {
      currentPassword,
      newUsername,
      newPassword
    });

    res.json({ success: true, ...result });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      error: error.message || 'Failed to update credentials'
    });
  }
}

export async function adminPanelMe(req, res) {
  res.json({
    success: true,
    user: {
      id: req.auth?.panelUserId,
      username: req.auth?.username
    }
  });
}
