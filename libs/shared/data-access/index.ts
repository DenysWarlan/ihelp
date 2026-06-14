// Guards
export { authGuard } from './guard/auth.guard';
export { roleGuard } from './guard/role.guard';

// Models
export type {
  PersonLoginRequest,
  PersonLoginResponse,
  StaffLoginRequest,
  TokenPair,
  MfaChallenge,
  StaffLoginResponse,
  UserProfile,
  JwtPayload,
} from './model/auth.model';

// Services
export { AuthService } from './service/auth.service';
export { AuthFacade } from './service/auth-facade.service';
export { ChatSocketService } from './service/chat-socket.service';
export { NavBadgeService } from './service/nav-badge.service';
export { NotificationSoundService } from './service/notification-sound.service';
export type { SocketChatMessage, SocketMessagesRead, SocketChatNotify } from './service/chat-socket.service';

// Conversations (non-case chat: staff↔staff, staff↔client, groups)
export { ConversationService } from './service/conversation.service';
export { ConversationSocketService } from './service/conversation-socket.service';
export { ConversationFacade } from './service/conversation-facade.service';
export { ConversationStore } from './store/conversation.store';
export type { ConversationMessageForm } from './service/conversation-facade.service';
export type {
  Conversation,
  ConversationKind,
  ConversationRole,
  ConversationMember,
  ConversationMessage,
  ConversationMessageStatus,
  ConversationContact,
  CreateConversationPayload,
  ConversationSocketMessage,
  ConversationSocketNotify,
  ConversationSocketTyping,
} from './model/conversation.model';
export type {
  PersonLoginFormModel,
  StaffLoginFormModel,
} from './service/auth-facade.service';

// Stores
export { AuthStore } from './store/auth.store';

// Interceptors
export { authInterceptor } from './interceptor/auth.interceptor';
