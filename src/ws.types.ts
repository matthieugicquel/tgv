export type ServerMessage = {
  type: 'update';
  sourceURL: string;
  modules_to_hot_replace: string[];
};

export type ClientMessage = { type: 'register'; client_id: string };
