import mongoose from 'mongoose';

const adminPanelUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 1,
    maxlength: 64
  },
  passwordHash: {
    type: String,
    required: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

adminPanelUserSchema.pre('save', function saveHook(next) {
  this.updatedAt = new Date();
  next();
});

const AdminPanelUser = mongoose.model('AdminPanelUser', adminPanelUserSchema);

export default AdminPanelUser;
