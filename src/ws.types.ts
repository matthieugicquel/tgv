export type ServerMessage = {
  type: 'update';
  sourceURL: string;
};

export type ClientMessage = { type: 'register'; client_id: string };
