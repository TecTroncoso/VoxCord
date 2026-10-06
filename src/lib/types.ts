export type User = {
  id: string;
  username: string;
  createdAt: number;
};

export type Server = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
};

export type ChannelType = 'text' | 'voice';

export type Channel = {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  createdAt: number;
};

export type ChatMessage = {
  seq: number;
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: number;
};
