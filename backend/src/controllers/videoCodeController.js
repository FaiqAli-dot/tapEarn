import VideoCode from '../models/VideoCode.js';

// Get video code by task ID
export const getVideoCode = async (req, res) => {
  try {
    const { taskId } = req.params;
    const videoCode = await VideoCode.getByTaskId(taskId);
    
    console.log(`📹 Getting video code for task: ${taskId}`);
    
    res.json({
      success: true,
      data: videoCode
    });
  } catch (error) {
    console.error('Error getting video code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get video code'
    });
  }
};

// Get all video codes (admin)
export const getAllVideoCodes = async (req, res) => {
  try {
    const videoCodes = await VideoCode.getAllActive();
    
    console.log(`📹 Getting all video codes: ${videoCodes.length} found`);
    
    res.json({
      success: true,
      data: videoCodes
    });
  } catch (error) {
    console.error('Error getting all video codes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get video codes'
    });
  }
};

// Create or update video code (admin)
export const createOrUpdateVideoCode = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { videoUrl, code, hint, timeToShow, points, isActive } = req.body;
    
    // Validate required fields
    if (!videoUrl || !code) {
      return res.status(400).json({
        success: false,
        error: 'Video URL and code are required'
      });
    }
    
    const videoCodeData = {
      videoUrl,
      code: code.toUpperCase(),
      hint: hint || 'Look for the code that appears in the video',
      timeToShow: timeToShow || 0.5,
      points: points || 100,
      isActive: isActive !== undefined ? isActive : true
    };
    
    const videoCode = await VideoCode.createOrUpdate(taskId, videoCodeData);
    
    console.log(`📹 Created/Updated video code for task: ${taskId} - Code: ${code}`);
    
    res.json({
      success: true,
      data: videoCode,
      message: 'Video code created/updated successfully'
    });
  } catch (error) {
    console.error('Error creating/updating video code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create/update video code'
    });
  }
};

// Delete video code (admin)
export const deleteVideoCode = async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const videoCode = await VideoCode.findOne({ taskId });
    if (!videoCode) {
      return res.status(404).json({
        success: false,
        error: 'Video code not found'
      });
    }
    
    videoCode.isActive = false;
    await videoCode.save();
    
    console.log(`📹 Deactivated video code for task: ${taskId}`);
    
    res.json({
      success: true,
      message: 'Video code deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting video code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete video code'
    });
  }
};

// Verify video code
export const verifyVideoCode = async (req, res) => {
  try {
    const { taskId, enteredCode } = req.body;
    
    if (!taskId || !enteredCode) {
      return res.status(400).json({
        success: false,
        error: 'Task ID and entered code are required'
      });
    }
    
    const videoCode = await VideoCode.getByTaskId(taskId);
    const isCorrect = enteredCode.trim().toUpperCase() === videoCode.code;
    
    console.log(`🔍 Verifying code for task: ${taskId} - Entered: ${enteredCode}, Correct: ${videoCode.code}, Result: ${isCorrect}`);
    
    res.json({
      success: true,
      data: {
        isCorrect,
        correctCode: videoCode.code,
        points: videoCode.points
      }
    });
  } catch (error) {
    console.error('Error verifying video code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify video code'
    });
  }
};
