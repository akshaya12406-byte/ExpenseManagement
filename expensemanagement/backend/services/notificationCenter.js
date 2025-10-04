const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUser } = require('./socketRegistry');
const { sendApprovalNotification } = require('./notificationService');

const now = () => new Date();

const buildNotificationPayload = (notification) => ({
  id: notification._id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  payload: notification.payload,
  createdAt: notification.createdAt,
  readAt: notification.readAt,
});

const shouldSendForUser = (user, type) => {
  if (!user || !user.preferences) return true;
  const { notificationTypes = [], muteUntil } = user.preferences;
  if (muteUntil && muteUntil > now()) return false;
  if (notificationTypes.length === 0) return true;
  return notificationTypes.includes(type);
};

const resolveChannels = (user, channels) => {
  const preferred = (user?.preferences?.notificationChannels || ['socket']).map((channel) => channel.toLowerCase());
  if (!channels || channels.length === 0) {
    return preferred;
  }
  return channels.filter((channel) => preferred.includes(channel.toLowerCase()));
};

const dispatchNotifications = async ({
  companyId,
  recipients = [],
  role,
  type = 'custom',
  title,
  message,
  payload = {},
  channels = ['socket'],
  createdBy,
}) => {
  if ((!recipients || recipients.length === 0) && !role) {
    throw new Error('Recipients or role must be provided');
  }

  const users = recipients.length
    ? await User.find({ _id: { $in: recipients } })
    : await User.find({ company: companyId, role });

  if (!users.length) return [];

  const notificationsToCreate = [];

  await Promise.all(
    users.map(async (user) => {
      if (!shouldSendForUser(user, type)) return;

      const resolvedChannels = resolveChannels(user, channels);
      if (!resolvedChannels.length) return;

      const notification = await Notification.create({
        company: companyId,
        recipient: user._id,
        role: user.role,
        type,
        title,
        message,
        payload,
        channels: resolvedChannels,
        deliveredChannels: [],
        createdBy,
      });

      notificationsToCreate.push(notification);

      if (resolvedChannels.includes('socket')) {
        emitToUser(user._id.toString(), 'notification:new', buildNotificationPayload(notification));
        notification.deliveredChannels.push('socket');
      }

      if (resolvedChannels.includes('email') && user.preferences?.receiveEmailNotifications) {
        await sendApprovalNotification({
          to: user.email,
          subject: title,
          text: message,
        });
        notification.deliveredChannels.push('email');
      }

      await notification.save();
    }),
  );

  return notificationsToCreate;
};

const markNotificationRead = async ({ notificationId, userId, read = true }) => {
  const notification = await Notification.findOne({ _id: notificationId, recipient: userId });
  if (!notification) {
    const error = new Error('Notification not found');
    error.status = 404;
    throw error;
  }

  notification.readAt = read ? now() : null;
  await notification.save();
  return buildNotificationPayload(notification);
};

const markAllNotificationsRead = async ({ userId }) => {
  await Notification.updateMany({ recipient: userId, readAt: { $exists: false } }, { readAt: now() });
};

const fetchNotifications = async ({ userId, type, onlyUnread, role, limit = 20, skip = 0 }) => {
  const query = { recipient: userId };
  if (type) query.type = type;
  if (role) query.role = role;
  if (onlyUnread) query.readAt = { $exists: false };

  const [items, total] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(query),
  ]);

  return {
    total,
    items: items.map(buildNotificationPayload),
  };
};

const updateNotificationPreferences = async ({ userId, preferences }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  user.preferences = {
    ...user.preferences?.toObject?.(),
    ...preferences,
  };
  await user.save();
  return user.preferences;
};

module.exports = {
  dispatchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  fetchNotifications,
  updateNotificationPreferences,
};
