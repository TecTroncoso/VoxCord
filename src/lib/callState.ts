'use client';

/**
 * Estado real de la llamada en la que está el usuario, elevado desde
 * VoiceChannel al shell para poder reflejarlo en el sidebar y en el rail
 * derecho (widget "En llamada" y contador por canal).
 * Solo contiene datos observados de verdad: la sala a la que se conectó el
 * usuario y los participantes que reporta LiveKit.
 */
export type CallParticipant = { identity: string; name: string };

export type CallState = {
  channelId: string;
  channelName?: string;
  participants: CallParticipant[];
};